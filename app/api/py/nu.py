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
    # Eliminar símbolos de moneda, comas y espacios
    clean_val = re.sub(r'[^\d.-]', '', value.replace(',', ''))
    try:
        return float(clean_val)
    except ValueError:
        return None

def process_nu_pdf(file_path, password=None):
    data = {
        "meta_info": {
            "banco": "NuBank",
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
            
            # Intentar extraer info básica de la cuenta/cliente (ejemplo hipotético)
            # NuBank suele tener "Hola, [Nombre]"
            name_match = re.search(r'Hola,\s+([^\n!]+)', all_text)
            if name_match:
                data["meta_info"]["cliente"]["nombre"] = name_match.group(1).strip()

            # Extraer transacciones
            # Patrón típico: DD MMM o DD/MM
            # Ejemplo: "18 AGO Compra en Amazon -50.000,00"
            # O en tablas. Intentaremos un regex genérico por ahora.
            
            lines = all_text.split('\n')
            for line in lines:
                # Buscar líneas que parezcan transacciones
                # Ejemplo: 18 AGO  Compra en...  -50.000
                # O 18/08/2025  Transferencia...  100.000
                match = re.search(r'(\d{1,2}\s+[A-Z]{3}|\d{1,2}/\d{1,2}(?:/\d{2,4})?)\s+(.+?)\s+([-+]?\s?[\d.,]+)', line)
                if match:
                    fecha = match.group(1).strip()
                    desc = match.group(2).strip()
                    valor_str = match.group(3).strip()
                    
                    valor = parse_currency(valor_str)
                    if valor is not None:
                        # Convertir fecha a format DD/MM si es posible
                        # Si es "18 AGO", convertir a "18/08" (aproximado)
                        month_map = {
                            'ENE': '01', 'FEB': '02', 'MAR': '03', 'ABR': '04',
                            'MAY': '05', 'JUN': '06', 'JUL': '07', 'AGO': '08',
                            'SEP': '09', 'OCT': '10', 'NOV': '11', 'DIC': '12'
                        }
                        for m_name, m_num in month_map.items():
                            if m_name in fecha.upper():
                                fecha = f"{fecha.split()[0]}/{m_num}"
                                break

                        data["transacciones"].append({
                            "fecha": fecha,
                            "descripcion": desc,
                            "valor": valor,
                            "saldo": 0 # NuBank a veces no muestra el saldo línea a línea en el extracto de tarjeta
                        })
                        
                        if valor > 0:
                            data["meta_info"]["resumen"]["total_abonos"] += valor
                        else:
                            data["meta_info"]["resumen"]["total_cargos"] += abs(valor)

            # Ajustar saldo actual si no se encuentra
            # (En un script real buscaríamos el "Saldo total" o similar)
            data["meta_info"]["resumen"]["saldo_actual"] = data["meta_info"]["resumen"]["total_abonos"] - data["meta_info"]["resumen"]["total_cargos"]

    except Exception as e:
        raise Exception(f"Error procesando PDF de NuBank: {str(e)}")

    return data

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Procesar extracto de NuBank')
    parser.add_argument('--input', type=str, required=True, help='Ruta al archivo PDF')
    parser.add_argument('--output', type=str, required=True, help='Ruta al archivo JSON de salida')
    parser.add_argument('--password', type=str, help='Contraseña del PDF')
    
    args = parser.parse_args()
    
    try:
        resultado = process_nu_pdf(args.input, args.password)
        
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(resultado, f, ensure_ascii=False, indent=2)
        
        print(f"Éxito: Archivo guardado en {args.output}")
            
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)
