// Shared storage upload/cleanup helpers — used by BOTH the public
// booking form (reference image, under inquiries/) and the admin panel
// (gallery/artist-photo/logo uploads, everywhere else in the bucket).
// One implementation of "validate, then upload, then get a public URL"
// and one implementation of "delete the underlying object" — so upload
// and cleanup behavior can't drift between public and admin code paths.

/**
 * Validate and upload a file to the media bucket under `folder`.
 * @param {File} file
 * @param {string} folder - e.g. 'inquiries', 'gallery', 'artists', 'site'
 * @returns {Promise<string>} the public URL
 */
async function uploadMediaFile(file, folder) {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);
  const client = requireSupabaseClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '');
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
  const { error: uploadError } = await client.storage.from(MEDIA_BUCKET).upload(path, file);
  if (uploadError) throw uploadError;
  const url = getMediaPublicUrl(path);
  if (!url) throw new Error('The image uploaded, but we could not get a link to it. Please try again.');
  return url;
}

/**
 * Delete the storage object behind a public media URL, if it belongs to
 * this bucket. Used to clean up orphaned files when an image is deleted
 * or replaced. Never throws for "nothing to delete" — only for a real
 * storage error, so callers can show a soft warning instead of failing
 * the whole action (the record change already succeeded).
 * @returns {Promise<boolean>} true if something was actually deleted.
 */
async function deleteMediaFile(url) {
  const path = getStorageObjectPath(url, MEDIA_BUCKET);
  if (!path) return false;
  const client = requireSupabaseClient();
  const { error } = await client.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) throw error;
  return true;
}

/**
 * Upload a customer's reference photo to the PRIVATE inquiry bucket.
 * Returns the storage path (not a public URL). Only signed-in admins can read it.
 * @param {File} file
 * @returns {Promise<string>} the object path inside INQUIRY_BUCKET
 */
async function uploadInquiryImage(file) {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);
  const client = requireSupabaseClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '');
  const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
  const { error } = await client.storage.from(INQUIRY_BUCKET).upload(path, file);
  if (error) throw error;
  return path;
}

/** True when a stored reference_image_url is a private-bucket path (not an http URL). */
function isPrivateInquiryPath(value) {
  return typeof value === 'string' && value.length > 0 && !/^https?:\/\//i.test(value);
}

/**
 * Resolve a stored reference image value to a displayable URL.
 * Older rows hold a public URL; new rows hold a private path and need a signed URL.
 * @returns {Promise<string|null>}
 */
async function getInquiryImageUrl(value) {
  if (!isPrivateInquiryPath(value)) return sanitizeUrl(value);
  const client = requireSupabaseClient();
  const { data, error } = await client.storage.from(INQUIRY_BUCKET).createSignedUrl(value, 3600);
  if (error || !data) return null;
  return sanitizeUrl(data.signedUrl);
}

/** Delete the file behind a stored reference_image_url (private path or legacy public URL). */
async function deleteInquiryImage(value) {
  if (isPrivateInquiryPath(value)) {
    const client = requireSupabaseClient();
    const { error } = await client.storage.from(INQUIRY_BUCKET).remove([value]);
    if (error) throw error;
    return true;
  }
  return deleteMediaFile(value);
}
