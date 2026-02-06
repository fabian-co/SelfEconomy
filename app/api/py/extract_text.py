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
                # We want to ensure that descriptions spanning multiple lines are captured together.
                # Table-based extraction is superior for bank statements as it preserves cell unity.
                
                # 1. Try to extract tables with multiple strategies
                table_settings = {
                    "vertical_strategy": "text", 
                    "horizontal_strategy": "text",
                    "snap_tolerance": 3,
                }
                
                tables = page.extract_tables() # Strategy 1: Visible lines
                if not tables:
                    tables = page.extract_tables(table_settings=table_settings) # Strategy 2: Text alignment
                
                table_text = ""
                if tables:
                    for table in tables:
                        for row in table:
                            if row and any(row):
                                # Join multi-line cells with space and strip extra whitespace
                                # This ensures that descriptions that span multiple lines in the PDF are captured as a single line.
                                clean_row = [str(cell).replace('\n', ' ').strip() if cell else "" for cell in row]
                                # We use a VERY wide separator (10 spaces) to distinguish structured columns from normal text flow.
                                table_text += "          ".join(clean_row) + "\n"
                        table_text += "\n"
                
                # 2. Get the normal text for non-tabular data (headers, summaries, etc.)
                raw_text = page.extract_text() or ""
                
                # 3. Combine both representations
                page_output = [f"--- PÁGINA {i+1} ---"]
                
                if table_text.strip():
                    page_output.append("[ESTRUCTURA_TABULAR_CON_DESCRIPCIONES_COMPLETAS]")
                    page_output.append("💡 Este bloque es el más preciso. Usa \\s{5,} como separador de columnas.")
                    page_output.append(table_text)
                
                page_output.append("[TEXTO_RAW_SIN_PROCESAR]")
                page_output.append(raw_text)
                
                text_content.append("\n".join(page_output))
                
    except Exception as e:
        error_msg = str(e).lower()
        error_type = type(e).__name__.lower()
        
        # Check for password-related errors
        password_keywords = ["password", "encrypted", "decrypt", "pdfsyntax", "pdfpassword"]
        
        is_password_error = (
            any(keyword in error_msg for keyword in password_keywords) or
            any(keyword in error_type for keyword in password_keywords) or
            (error_msg.strip() == "" or error_msg.strip() == "none")
        )
        
        if is_password_error:
            print("PASSWORD_REQUIRED", file=sys.stderr)
            sys.exit(10)
        
        raise Exception(f"Error extrayendo texto de PDF: {str(e)}")
    return "\n\n".join(text_content)

def extract_text_from_excel(file_path, rows_per_page=50):
    try:
        df = pd.read_excel(file_path)
        return split_dataframe_into_pages(df, rows_per_page)
    except Exception as e:
        raise Exception(f"Error extrayendo texto de Excel: {str(e)}")

def split_dataframe_into_pages(df, rows_per_page=50):
    """Split a dataframe into pages with page markers, similar to PDF processing."""
    text_content = []
    total_rows = len(df)
    num_pages = (total_rows + rows_per_page - 1) // rows_per_page  # Ceiling division
    
    for page_num in range(num_pages):
        start_row = page_num * rows_per_page
        end_row = min(start_row + rows_per_page, total_rows)
        page_df = df.iloc[start_row:end_row]
        
        page_output = [f"--- PÁGINA {page_num + 1} ---"]
        page_output.append("[ESTRUCTURA_TABULAR_CON_DESCRIPCIONES_COMPLETAS]")
        page_output.append(f"💡 Filas {start_row + 1} a {end_row} de {total_rows} total.")
        page_output.append(page_df.to_csv(index=False))
        
        text_content.append("\n".join(page_output))
    
    return "\n\n".join(text_content)

def extract_text_from_csv(file_path, rows_per_page=50):
    try:
        # Try different encodings
        for enc in ['utf-8', 'latin-1', 'cp1252']:
            try:
                df = pd.read_csv(file_path, encoding=enc)
                return split_dataframe_into_pages(df, rows_per_page)
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
