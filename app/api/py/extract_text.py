import pdfplumber
import pandas as pd
import json
import sys
import os
import argparse

def extract_text_from_pdf(file_path, password=None):
    text_content = []
    try:
        with pdfplumber.open(file_path, password=password) as pdf:
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    text_content.append(f"--- PÁGINA {i+1} ---\n{page_text}")
    except Exception as e:
        raise Exception(f"Error extrayendo texto de PDF: {str(e)}")
    return "\n\n".join(text_content)

def extract_text_from_excel(file_path):
    try:
        df = pd.read_excel(file_path)
        # Convert to CSV for robust processing
        return df.to_csv(index=False)
    except Exception as e:
        raise Exception(f"Error extrayendo texto de Excel: {str(e)}")

def extract_text_from_csv(file_path):
    try:
        # Try different encodings
        for enc in ['utf-8', 'latin-1', 'cp1252']:
            try:
                df = pd.read_csv(file_path, encoding=enc)
                return df.to_csv(index=False)
            except UnicodeDecodeError:
                continue
        raise Exception("No se pudo decodificar el archivo CSV con los encodings probados.")
    except Exception as e:
        raise Exception(f"Error extrayendo texto de CSV: {str(e)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extractor Universal de Texto para Extractos')
    parser.add_argument('--input', type=str, required=True, help='Ruta al archivo de entrada')
    parser.add_argument('--password', type=str, help='Contraseña para PDFs')
    parser.add_argument('--output', type=str, required=True, help='Ruta al archivo TXT de salida')
    
    args = parser.parse_args()
    
    file_ext = os.path.splitext(args.input)[1].lower()
    
    try:
        if file_ext == '.pdf':
            text = extract_text_from_pdf(args.input, args.password)
        elif file_ext in ['.xlsx', '.xls']:
            text = extract_text_from_excel(args.input)
        elif file_ext == '.csv':
            text = extract_text_from_csv(args.input)
        else:
            raise Exception(f"Extensión de archivo no soportada: {file_ext}")
            
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(text)
            
        print(f"Éxito: Texto extraído en {args.output}")
            
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)
