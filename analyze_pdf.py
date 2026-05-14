import fitz # PyMuPDF
import sys

def analyze_pdf(path):
    doc = fitz.open(path)
    for i in range(min(2, len(doc))):
        page = doc[i]
        print(f"--- PAGE {i+1} ---")
        words = page.get_text("words")
        for w in words[:50]: # Print first 50 words and their bounding boxes
            print(w)
        
        images = page.get_images(full=True)
        print(f"Found {len(images)} images")
        for img in images:
            xref = img[0]
            rects = page.get_image_rects(xref)
            print(f"Image {xref} rects: {rects}")

if __name__ == "__main__":
    analyze_pdf("Catálogo 20 de abril.pdf")
