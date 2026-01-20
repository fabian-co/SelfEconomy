import pdfplumber
import sys

file_path = "c:\\Users\\fabia\\Developer\\SelfEconomy\\SelfEconomy\\app\\api\\extracto\\other\\default\\Nu_2025-08-18.pdf"
password = "1111"

try:
    with pdfplumber.open(file_path, password=password) as pdf:
        print(f"Número de páginas: {len(pdf.pages)}")
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            print(f"--- PÁGINA {i+1} ---")
            print(text[:200] if text else "Sin texto")
except Exception as e:
    print(f"ERROR: {str(e)}")
