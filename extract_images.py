import fitz
import os
import re
import math

def extract_images_from_pdf(path, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    doc = fitz.open(path)
    
    # Matches product codes: 3 to 10 alphanumeric chars with at least one digit
    code_pattern = re.compile(r'^[A-Z0-9-]{3,10}$')
    
    extracted = 0
    saved_codes = set()
    
    for i in range(len(doc)):
        page = doc[i]
        words = page.get_text("words")
        
        # Filter words to only those that look like codes
        code_words = [w for w in words if code_pattern.match(w[4].strip()) and sum(c.isdigit() for c in w[4].strip()) >= 2]
        
        images = page.get_images(full=True)
        for img_info in images:
            xref = img_info[0]
            try:
                rects = page.get_image_rects(xref)
                if not rects: continue
                rect = rects[0]
            except Exception:
                continue
            
            width = rect.x1 - rect.x0
            height = rect.y1 - rect.y0
            
            # Skip likely logos or background graphics or full page images
            if width < 30 or height < 30 or width > 500 or height > 500:
                continue
                
            closest_code = None
            min_dist = float('inf')
            
            # Image center
            ix = (rect.x0 + rect.x1) / 2
            iy = (rect.y0 + rect.y1) / 2
            
            for w in code_words:
                wx = (w[0] + w[2]) / 2
                wy = (w[1] + w[3]) / 2
                
                # Distance heuristic
                dist = math.hypot(wx - ix, wy - iy)
                if dist < min_dist:
                    min_dist = dist
                    closest_code = w[4].strip()
                    
            # If code found and reasonably close
            if closest_code and min_dist < 300: 
                try:
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    ext = base_image["ext"]
                    
                    # Handle duplicates
                    save_code = closest_code
                    counter = 1
                    while save_code in saved_codes:
                        save_code = f"{closest_code}_{counter}"
                        counter += 1
                        
                    saved_codes.add(save_code)
                    
                    filename = os.path.join(output_dir, f"{save_code}.{ext}")
                    with open(filename, "wb") as f:
                        f.write(image_bytes)
                    extracted += 1
                except Exception as e:
                    print(f"Error extracting image {xref}: {e}")

    print(f"Extracted {extracted} images to {output_dir}")

if __name__ == "__main__":
    extract_images_from_pdf("Catálogo 20 de abril.pdf", "imagenes_extraidas")
