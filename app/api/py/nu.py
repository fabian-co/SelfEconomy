import pdfplumber
import json
import sys
import os
import argparse
import re
from datetime import datetime

def parse_currency(value):
    if not value:
        return None
    # Eliminar símbolos de moneda y espacios
    clean_val = value.replace('$', '').replace(' ', '')
    
    # Manejar formato colombiano 1.234.567,89 o 50.000,00
    # Si hay punto y coma, el punto es miles y la coma es decimal
    if '.' in clean_val and ',' in clean_val:
        clean_val = clean_val.replace('.', '').replace(',', '.')
    # Si hay coma y no hay punto, y hay 2 dígitos después de la coma, es decimal
    elif ',' in clean_val:
        parts = clean_val.split(',')
        if len(parts[-1]) <= 2:
            clean_val = clean_val.replace('.', '').replace(',', '.')
        else:
            # Si hay más de 2 dígitos, la coma podría ser de miles (formato US), 
            # pero en NuBank Colombia suele ser decimal
            clean_val = clean_val.replace('.', '').replace(',', '.')
            
    try:
        return float(clean_val)
    except ValueError:
        return None

def process_nu_pdf(file_path, password=None, account_type='debit', analyze_only=False, payment_keywords=None):
    if analyze_only:
        # Return only unique transaction descriptions
        unique_descriptions = set()
        try:
            with pdfplumber.open(file_path, password=password) as pdf:
                all_text = ""
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        all_text += text + "\n"
                
                lines = all_text.split('\n')
                current_tx_desc = None
                desc_line_count = 0
                
                TX_REGEX = r'^(\d{1,2}\s+[A-Z]{3}|\d{1,2}/\d{1,2}(?:/\d{2,4})?)\s+(.+?)\s+((\$|[-+])?\s*[\d.]+,\d{2})'
                STOP_KEYWORDS = ["Fecha", "Descripción", "Valor", "Cuotas", "Interés", "Total a pagar", "Página", "NIT", "Nu Financiera", "Extracto"]
                
                for line in lines:
                    line = line.strip()
                    if not line: continue
                    
                    if " - " in line and re.search(r'[A-Z]{3}.* - .*[A-Z]{3}', line):
                        continue
                        
                    match = re.search(TX_REGEX, line)
                    if match:
                        desc = match.group(2).strip().rstrip('$').strip()
                        unique_descriptions.add(desc)
                        current_tx_desc = desc
                        desc_line_count = 1
                    elif current_tx_desc and desc_line_count < 3:
                        # Stop if any stop keyword is found
                        if any(k.lower() in line.lower() for k in STOP_KEYWORDS):
                            current_tx_desc = None
                            continue
                            
                        # Skip sub-details or lines with currency that aren't new transactions
                        if line.startswith('↳') or 'A capital' in line or 'A intereses' in line or re.search(r'(\$|[-+])?\s*[\d.]+,\d{2}', line):
                            current_tx_desc = None
                            continue

                        year_match = re.match(r'^(\d{4})\s+(.*)', line)
                        if year_match:
                            extra = year_match.group(2).strip()
                            if extra:
                                if current_tx_desc in unique_descriptions:
                                    unique_descriptions.remove(current_tx_desc)
                                current_tx_desc = f"{current_tx_desc} {extra}".strip()
                                unique_descriptions.add(current_tx_desc)
                                desc_line_count += 1
                        else:
                            if current_tx_desc in unique_descriptions:
                                unique_descriptions.remove(current_tx_desc)
                            current_tx_desc = f"{current_tx_desc} {line}".strip()
                            unique_descriptions.add(current_tx_desc)
                            desc_line_count += 1
                        
        except Exception as e:
            raise Exception(f"Error analizando PDF de NuBank: {str(e)}")
            
        return {"descriptions": sorted(list(unique_descriptions))}

    data = {
        "meta_info": {
            "banco": "NuBank",
            "tipo_cuenta": account_type,
            "payment_keywords": payment_keywords or [],
            "source_file_path": file_path,
            "cliente": {},
            "cuenta": {},
            "resumen": {
                "saldo_actual": 0,
                "total_abonos": 0,
                "total_cargos": 0
            }
        },
        "transacciones": []
    }

    try:
        with pdfplumber.open(file_path, password=password) as pdf:
            all_text = ""
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    all_text += text + "\n"
            
            # Intentar extraer info básica de la cuenta/cliente
            name_match = re.search(r'Hola,\s+([^\n!]+)', all_text)
            if name_match:
                data["meta_info"]["cliente"]["nombre"] = name_match.group(1).strip()

            lines = all_text.split('\n')
            temp_transactions = []
            current_tx = None
            desc_line_count = 0
            
            TX_REGEX = r'^(\d{1,2}\s+[A-Z]{3}|\d{1,2}/\d{1,2}(?:/\d{2,4})?)\s+(.+?)\s+((\$|[-+])?\s*[\d.]+,\d{2})'
            STOP_KEYWORDS = ["Fecha", "Descripción", "Valor", "Cuotas", "Interés", "Total a pagar", "Página", "NIT", "Nu Financiera", "Extracto"]
            
            for line in lines:
                line = line.strip()
                if not line: continue
                
                if " - " in line and re.search(r'[A-Z]{3}.* - .*[A-Z]{3}', line):
                    continue
                
                match = re.search(TX_REGEX, line)
                if match:
                    if current_tx:
                        temp_transactions.append(current_tx)
                    
                    current_tx = {
                        "fecha": match.group(1).strip(),
                        "descripcion": match.group(2).strip().rstrip('$').strip(),
                        "valor_str": match.group(3).strip()
                    }
                    desc_line_count = 1
                elif current_tx and desc_line_count < 3:
                    # Check stop keywords
                    if any(k.lower() in line.lower() for k in STOP_KEYWORDS):
                        temp_transactions.append(current_tx)
                        current_tx = None
                        continue

                    # Skip sub-details or lines with currency that aren't new transactions
                    if line.startswith('↳') or 'A capital' in line or 'A intereses' in line or re.search(r'(\$|[-+])?\s*[\d.]+,\d{2}', line):
                        temp_transactions.append(current_tx)
                        current_tx = None
                        continue

                    year_match = re.match(r'^(\d{4})\s+(.*)', line)
                    if year_match:
                        extra = year_match.group(2).strip()
                        if extra:
                            current_tx["descripcion"] = f"{current_tx['descripcion']} {extra}".strip()
                            desc_line_count += 1
                    else:
                        current_tx["descripcion"] = f"{current_tx['descripcion']} {line}".strip()
                        desc_line_count += 1

            if current_tx:
                temp_transactions.append(current_tx)

            for tx_data in temp_transactions:
                fecha = tx_data["fecha"]
                desc = tx_data["descripcion"]
                valor_str = tx_data["valor_str"]
                
                valor = parse_currency(valor_str)
                if valor is not None:
                    month_map = {
                        'ENE': '01', 'FEB': '02', 'MAR': '03', 'ABR': '04',
                        'MAY': '05', 'JUN': '06', 'JUL': '07', 'AGO': '08',
                        'SEP': '09', 'OCT': '10', 'NOV': '11', 'DIC': '12'
                    }
                    for m_name, m_num in month_map.items():
                        if m_name in fecha.upper():
                            fecha = f"{fecha.split()[0]}/{m_num}"
                            break

                    # Determinate if it is a payment based on keywords
                    is_payment = False
                    if payment_keywords and len(payment_keywords) > 0:
                        # User provided keywords (partial match logic)
                        is_payment = any(k.lower() in desc.lower() for k in payment_keywords)
                   
                    if not is_payment:
                        valor = -abs(valor)
                    else:
                        valor = abs(valor)

                    data["transacciones"].append({
                        "fecha": fecha,
                        "descripcion": desc,
                        "valor": valor,
                        "saldo": 0,
                        "ignored": is_payment
                    })
                    
                    if not is_payment:
                        if valor > 0:
                            data["meta_info"]["resumen"]["total_abonos"] += valor
                        else:
                            data["meta_info"]["resumen"]["total_cargos"] += abs(valor)

            data["meta_info"]["resumen"]["saldo_actual"] = data["meta_info"]["resumen"]["total_abonos"] - data["meta_info"]["resumen"]["total_cargos"]

    except Exception as e:
        raise Exception(f"Error procesando PDF de NuBank: {str(e)}")

    return data

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Procesar extracto de NuBank')
    parser.add_argument('--input', type=str, required=True, help='Ruta al archivo PDF')
    parser.add_argument('--output', type=str, required=True, help='Ruta al archivo JSON de salida')
    parser.add_argument('--password', type=str, help='Contraseña del PDF')
    parser.add_argument('--account-type', type=str, default='debit', help='Tipo de cuenta (debit/credit)')
    parser.add_argument('--analyze', action='store_true', help='Solo analizar descripciones únicas')
    parser.add_argument('--payment-keywords', type=str, nargs='*', help='Palabras clave para identificar pagos')
    
    args = parser.parse_args()
    
    try:
        resultado = process_nu_pdf(args.input, args.password, args.account_type, args.analyze, args.payment_keywords)
        
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(resultado, f, ensure_ascii=False, indent=2)
        
        print(f"Éxito: Archivo guardado en {args.output}")
            
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)
