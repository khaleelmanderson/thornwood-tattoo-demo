// book.html page controller — the public booking/inquiry form.
//
// Reference-image validation uses the exact same validateImageFile()
// from assets/js/validation.js that the admin panel's gallery upload
// uses (Checkpoint 3) — same file, same rules, so they can't drift.

const PAGE_LOADED_AT = Date.now();

document.addEventListener('DOMContentLoaded', async () => {
  await loadSiteConfig();
  prefillPreferredArtist();
  wireImagePreview();
  wireForm();
});

async function prefillPreferredArtist() {
  const slug = new URLSearchParams(window.location.search).get('artist');
  const note = document.getElementById('preferred-artist-note');
  if (!slug || !note) return;
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('artists').select('id, name, slug').eq('slug', slug).maybeSingle();
    if (error) throw error;
    if (data) {
      note.hidden = false;
      note.textContent = `Booking request for: ${data.name}`;
      note.dataset.artistId = data.id;
    }
  } catch (err) {
    // Non-critical — the form still works without a prefilled artist name.
    console.error('Could not look up the preferred artist:', err);
  }
}

function wireImagePreview() {
  const input = document.getElementById('reference_image');
  const preview = document.getElementById('reference_image_preview');
  if (!input) return;
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    clearFieldError('reference_image');
    if (!file) {
      if (preview) preview.hidden = true;
      return;
    }
    const err = validateImageFile(file);
    if (err) {
      input.value = '';
      if (preview) preview.hidden = true;
      setFieldError('reference_image', err);
      return;
    }
    if (preview) {
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
    }
  });
}

function wireForm() {
  const form = document.getElementById('booking-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitBooking(form);
  });
}

function fieldValue(form, name) {
  return (form.elements[name]?.value || '').trim();
}

function validateBookingForm(form) {
  const errors = {};
  const name = fieldValue(form, 'name');
  const email = fieldValue(form, 'email');
  const message = fieldValue(form, 'message');

  if (!name) errors.name = 'Please tell us your name.';
  if (!email) errors.email = 'Please enter your email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'That email address doesn’t look right.';
  if (!message) errors.message = 'Please describe what you have in mind.';

  const fileInput = form.elements['reference_image'];
  const file = fileInput && fileInput.files && fileInput.files[0];
  if (file) {
    const err = validateImageFile(file);
    if (err) errors.reference_image = err;
  }

  return errors;
}

function clearAllFieldErrors(form) {
  form.querySelectorAll('.field').forEach((field) => {
    field.classList.remove('has-error');
    const errorEl = field.querySelector('.field-error');
    if (errorEl) errorEl.textContent = '';
    const input = field.querySelector('input, textarea, select');
    if (input) input.removeAttribute('aria-invalid');
  });
}

function clearFieldError(name) {
  const input = document.getElementById(name);
  if (!input) return;
  const field = input.closest('.field');
  if (!field) return;
  field.classList.remove('has-error');
  const errorEl = field.querySelector('.field-error');
  if (errorEl) errorEl.textContent = '';
  input.removeAttribute('aria-invalid');
}

function setFieldError(name, message) {
  const input = document.getElementById(name);
  if (!input) return;
  const field = input.closest('.field');
  if (!field) return;
  field.classList.add('has-error');
  const errorEl = field.querySelector('.field-error');
  if (errorEl) errorEl.textContent = message;
  input.setAttribute('aria-invalid', 'true');
}

async function submitBooking(form) {
  const alertBox = document.getElementById('booking-alert');
  const submitBtn = form.querySelector('button[type="submit"]');
  clearAllFieldErrors(form);
  if (alertBox) { alertBox.hidden = true; }

  // Spam trap: real people never fill the hidden 'website' field. Bots that do get a
  // normal-looking success message and nothing is saved, so they learn nothing.
  const honeypot = form.elements['website'];
  if (honeypot && honeypot.value) {
    showFakeSuccess(form, alertBox);
    return;
  }

  const errors = validateBookingForm(form);
  if (Object.keys(errors).length) {
    Object.entries(errors).forEach(([name, message]) => setFieldError(name, message));
    const firstInvalid = form.querySelector('.has-error input, .has-error textarea, .has-error select');
    if (firstInvalid) firstInvalid.focus();
    if (alertBox) {
      alertBox.hidden = false;
      alertBox.className = 'alert alert-error';
      alertBox.textContent = 'Please fix the highlighted fields and try again.';
    }
    return;
  }

  // Second trap: humans need more than a few seconds to fill this form.
  if (Date.now() - PAGE_LOADED_AT < 3000) {
    showFakeSuccess(form, alertBox);
    return;
  }

  const originalLabel = submitBtn ? submitBtn.textContent : '';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

  try {
    const client = requireSupabaseClient();
    const note = document.getElementById('preferred-artist-note');
    const preferredArtistId = note && !note.hidden ? note.dataset.artistId : null;

    let referenceImageUrl = null;
    const fileInput = form.elements['reference_image'];
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (file) {
      referenceImageUrl = await uploadInquiryImage(file);
    }

    const payload = {
      name: fieldValue(form, 'name'),
      email: fieldValue(form, 'email'),
      phone: fieldValue(form, 'phone') || null,
      message: fieldValue(form, 'message'),
      placement: fieldValue(form, 'placement') || null,
      size_estimate: fieldValue(form, 'size_estimate') || null,
      reference_image_url: referenceImageUrl,
      artist_id: preferredArtistId || null,
    };

    const { error: insertError } = await client.from('inquiries').insert(payload);
    if (insertError) throw insertError;

    form.reset();
    const preview = document.getElementById('reference_image_preview');
    if (preview) preview.hidden = true;
    if (alertBox) {
      alertBox.hidden = false;
      alertBox.className = 'alert alert-success';
      alertBox.textContent = "Thanks! Your request has been sent — we'll get back to you soon.";
    }
    alertBox?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    console.error('Booking submission failed:', err);
    if (alertBox) {
      alertBox.hidden = false;
      alertBox.className = 'alert alert-error';
      alertBox.textContent = "Something went wrong sending your request. Please try again, or reach out to us directly.";
      alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
  }
}

function showFakeSuccess(form, alertBox) {
  form.reset();
  if (alertBox) {
    alertBox.hidden = false;
    alertBox.className = 'alert alert-success';
    alertBox.textContent = "Thanks! Your request has been sent, and we will get back to you soon.";
  }
}
