// Shared image upload validation.
//
// Used by the public booking form's reference-image upload AND the admin
// panel's gallery/artist-photo uploads (Checkpoint 3). This is the SAME
// file, not a copy — a change here changes both, so the two can never
// silently drift apart. Ported from website-portfolio's image validation.

const IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const IMAGE_UPLOAD_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Validate a File selected for upload.
 * @param {File} file
 * @returns {string|null} a human-readable error message, or null if valid.
 */
function validateImageFile(file) {
  if (!file) return 'Please choose an image file.';
  if (!file.type || !IMAGE_UPLOAD_ALLOWED_TYPES.includes(file.type)) {
    return 'Only JPG, PNG, WEBP, or GIF images are allowed.';
  }
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
    return 'Image must be 5MB or smaller.';
  }
  return null;
}

/**
 * Validate every file in a FileList/array in one pass.
 * @param {FileList|File[]} files
 * @returns {string|null} the first error found, or null if all valid.
 */
function validateImageFiles(files) {
  for (const file of Array.from(files || [])) {
    const err = validateImageFile(file);
    if (err) return err;
  }
  return null;
}
