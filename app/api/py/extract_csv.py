import pdfplumber
import pandas as pd
import sys
import os
import argparse

def extract_csv_from_pdf(file_path, password=None):
    """
    Extracts ALL data from PDF using multiple strategies:
    1. Table extraction for structured data
    2. Text extraction for non-tabular content
    Combines both approaches for maximum data capture.
    """
    all_rows = []
    
    try:
        with pdfplumber.open(file_path, password=password) as pdf:
            for page_num, page in enumerate(pdf.pages):
                # Add page separator
                all_rows.append([f"--- PÁGINA {page_num + 1} ---", "", "", "", ""])
                
                # Try multiple table extraction strategies
                table_strategies = [
                    # Strategy 1: Default (visible lines)
                    {},
                    # Strategy 2: Text-based alignment
                    {
                        "vertical_strategy": "text",
                        "horizontal_strategy": "text",
                        "snap_tolerance": 3,
                    },
                    # Strategy 3: More aggressive text detection
                    {
                        "vertical_strategy": "text",
                        "horizontal_strategy": "text",
                        "snap_tolerance": 5,
                        "join_tolerance": 3,
                    },
                ]
                
                tables_found = False
                for settings in table_strategies:
                    tables = page.extract_tables(table_settings=settings) if settings else page.extract_tables()
                    
                    if tables:
                        tables_found = True
                        for table in tables:
                            for row in table:
                                if row and any(cell for cell in row if cell):
                                    # Clean each cell: remove newlines, strip whitespace
                                    clean_row = [
                                        str(cell).replace('\n', ' ').replace('\r', ' ').strip() if cell else ""
                                        for cell in row
                                    ]
                                    all_rows.append(clean_row)
                        break  # Use first successful strategy
                
                # If no tables found, extract as text lines (fallback)
                if not tables_found:
                    text = page.extract_text()
                    if text:
                        for line in text.split('\n'):
                            line = line.strip()
                            if line:
                                # Split by multiple spaces to attempt column detection
                                parts = [p.strip() for p in line.split('  ') if p.strip()]
                                if len(parts) > 1:
                                    all_rows.append(parts)
                                else:
                                    all_rows.append([line])
                                    
    except Exception as e:
        error_msg = str(e).lower()
        error_type = type(e).__name__.lower()
        
        password_keywords = ["password", "encrypted", "decrypt", "pdfsyntax", "pdfpassword"]
        is_password_error = (
            any(keyword in error_msg for keyword in password_keywords) or
            any(keyword in error_type for keyword in password_keywords) or
            (error_msg.strip() == "" or error_msg.strip() == "none")
        )
        
        if is_password_error:
            print("PASSWORD_REQUIRED", file=sys.stderr)
            sys.exit(10)
        
        raise Exception(f"Error extrayendo CSV de PDF: {str(e)}")
    
    if not all_rows:
        return ""
    
    # Find maximum column count
    max_cols = max(len(row) for row in all_rows)
    
    # Normalize all rows to have the same number of columns
    normalized_rows = []
    for row in all_rows:
        if len(row) < max_cols:
            row = row + [''] * (max_cols - len(row))
        normalized_rows.append(row)
    
    # Convert to DataFrame and then to CSV
    df = pd.DataFrame(normalized_rows)
    return df.to_csv(index=False, header=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extractor de tablas PDF a CSV')
    parser.add_argument('--input', type=str, required=True, help='Ruta al archivo PDF de entrada')
    parser.add_argument('--password', type=str, help='Contraseña para PDFs protegidos')
    parser.add_argument('--output', type=str, required=True, help='Ruta al archivo CSV de salida')
    
    args = parser.parse_args()
    
    file_ext = os.path.splitext(args.input)[1].lower()
    
    try:
        if file_ext != '.pdf':
            raise Exception(f"Este script solo soporta archivos PDF, recibido: {file_ext}")
        
        csv_content = extract_csv_from_pdf(args.input, args.password)
        
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        with open(args.output, "w", encoding="utf-8-sig") as f:  # utf-8-sig for Excel compatibility
            f.write(csv_content)
        
        print(f"Éxito: CSV extraído en {args.output}")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)
