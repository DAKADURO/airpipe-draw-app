import os
import uuid
import base64
import re

UPLOAD_FOLDER = 'server_uploads'

def ensure_upload_folder():
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)

def process_project_assets(data):
    """
    Extracts base64 images from project data, saves them to disk,
    and updates the data with the file paths.
    """
    if not isinstance(data, dict):
        return data

    bg_base64 = data.get('bgBase64')
    
    # Check if bgBase64 is a data URI
    if bg_base64 and isinstance(bg_base64, str) and bg_base64.startswith('data:image/'):
        try:
            ensure_upload_folder()
            
            # Extract header and data
            header, encoded = bg_base64.split(',', 1)
            
            # Determine extension
            ext = 'png'
            if 'image/jpeg' in header: ext = 'jpg'
            elif 'image/webp' in header: ext = 'webp'
            
            filename = f"bg_{uuid.uuid4().hex}.{ext}"
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            
            # Decode and save
            with open(filepath, 'wb') as f:
                f.write(base64.b64decode(encoded))
            
            # Update project data
            data['bgBase64'] = None
            data['bgUrl'] = f"/{UPLOAD_FOLDER}/{filename}"
            
            print(f"INFO: Saved background image to {filepath}")
            
        except Exception as e:
            print(f"ERROR: Failed to process background image: {e}")
            # We don't modify data if it fails, or maybe we should clear it to avoid DB bloat?
            # For now, keep it as is if it fails.
            
    return data
