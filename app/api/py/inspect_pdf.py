import pdfplumber
import sys

def inspect_pdf(file_path):
    try:
        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                print(f"--- Page {i+1} ---")
                print(page.extract_text())
                print("\n" + "="*50 + "\n")
    except Exception as e:
        import traceback
        print(f"Error reading PDF: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        inspect_pdf(sys.argv[1])
    else:
        print("Please provide a PDF file path.")
