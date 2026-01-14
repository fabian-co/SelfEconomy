import csv
import json
import sys
import os
import argparse
import pandas as pd

def parse_currency(value):
    """
    Convierte cadenas con formato moneda (ej: "1,450.00") a float.
    Retorna None si no es un número válido.
    """
    if not value:
        return None
    # Eliminar comillas dobles, comas y espacios
    clean_val = value.replace('"', '').replace(',', '').strip()
    try:
        return float(clean_val)
    except ValueError:
        return None

def convert_xlsx_to_csv(xlsx_path, csv_path):
    """
    Convierte un archivo XLSX a CSV usando pandas.
    """
    try:
        df = pd.read_excel(xlsx_path)
        df.to_csv(csv_path, index=False, encoding='utf-8')
        return csv_path
    except Exception as e:
        raise Exception(f"Error al convertir XLSX a CSV: {str(e)}")

def process_extract(file_path, account_type='debit'):
    # Estructura base del JSON resultante
    data = {
        "meta_info": {
            "banco": "Bancolombia",
            "tipo_cuenta": account_type,
            "cliente": {},
            "cuenta": {},
            "resumen": {}
        },
        "transacciones": []
    }
    
    # Mapeo de títulos de sección a claves en nuestro JSON
    sections = {
        "Información Cliente:": "cliente",
        "Información General:": "cuenta",
        "Resumen:": "resumen",
        "Movimientos:": "transacciones"
    }
    
    current_section = None
    headers = []
    
    # Intentar con diferentes encodificaciones
    encodings = ['utf-8', 'latin-1', 'cp1252']
    rows = []
    
    for enc in encodings:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                reader = csv.reader(f)
                rows = list(reader)
            if rows:
                break
        except (UnicodeDecodeError, FileNotFoundError):
            continue

        
    for i, row in enumerate(rows):
        # Saltar filas vacías
        if not row: continue
        
        first_cell = row[0].strip()
        
        # 1. Detectar cambio de sección
        # 1. Detectar cambio de sección (búsqueda parcial para evitar problemas de tildes)
        found_section = None
        for marker, key in sections.items():
            # Limpiamos el marcador de dos puntos y espacios para comparar mejor
            clean_marker = marker.replace(":", "").strip()
            if clean_marker in first_cell or first_cell in clean_marker:
                found_section = key
                break
        
        if found_section:
            current_section = found_section
            # Usualmente los headers reales están en la siguiente línea
            if i + 1 < len(rows):
                # Limpiamos headers vacíos
                headers = [h.strip() for h in rows[i+1] if h.strip()]
            continue

            
        # Ignorar líneas que sean repetición de headers o vacías
        if not first_cell or (headers and first_cell == headers[0]):
            continue

        # 2. Procesar datos según la sección actual
        if current_section == "cliente":
            if not data["meta_info"]["cliente"]:
                vals = [c for c in row if c.strip()]
                # Asignación segura basada en posición
                if len(vals) >= 1: data["meta_info"]["cliente"]["nombre"] = vals[0]
                if len(vals) >= 2: data["meta_info"]["cliente"]["direccion"] = vals[1]
                if len(vals) >= 3: data["meta_info"]["cliente"]["ciudad"] = vals[2]

        elif current_section == "cuenta":
            if not data["meta_info"]["cuenta"]:
                vals = [c for c in row if c.strip()]
                keys = ["desde", "hasta", "tipo_cuenta", "numero_cuenta", "sucursal"]
                for idx, val in enumerate(vals):
                    if idx < len(keys):
                        data["meta_info"]["cuenta"][keys[idx]] = val

        elif current_section == "resumen":
            if not data["meta_info"]["resumen"]:
                vals = [c for c in row if c.strip()]
                keys = ["saldo_anterior", "total_abonos", "total_cargos", "saldo_actual", 
                        "saldo_promedio", "cupo_sugerido", "intereses", "retefuente"]
                for idx, val in enumerate(vals):
                    if idx < len(keys):
                        data["meta_info"]["resumen"][keys[idx]] = parse_currency(val)

        elif current_section == "transacciones":
            # Lógica inteligente para filas con columnas desplazadas (comas en descripción)
            non_empty = [c for c in row if c.strip()]
            
            # Necesitamos mínimo Fecha, Valor y Saldo
            if len(non_empty) >= 3:
                fecha = non_empty[0]
                
                # Tomamos Saldo y Valor desde el final hacia atrás (Ancla Derecha)
                saldo = parse_currency(non_empty[-1])
                valor = parse_currency(non_empty[-2])
                
                # Todo lo que hay en el medio es la descripción
                desc_parts = non_empty[1:-2]
                descripcion = " ".join(desc_parts)
                
                data["transacciones"].append({
                    "fecha": fecha,
                    "descripcion": descripcion,
                    "valor": valor,
                    "saldo": saldo
                })

    return data

# Uso del script
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Procesar extracto de Bancolombia')
    parser.add_argument('--input', type=str, help='Ruta al archivo CSV de entrada')
    parser.add_argument('--output', type=str, help='Ruta al archivo JSON de salida')
    parser.add_argument('--account-type', type=str, default='debit', help='Tipo de cuenta (debit/credit)')
    
    args = parser.parse_args()
    
    archivo_entrada = args.input if args.input else "app/api/extracto/bancolombia/scv/Extracto_202512_Cuentas_de ahorro_7666.csv"
    output_file = args.output if args.output else "app/api/extracto/bancolombia/process/extracto_procesado.json"
    
    # Manejar archivos XLSX
    if archivo_entrada.lower().endswith('.xlsx'):
        csv_convertido = archivo_entrada.rsplit('.', 1)[0] + ".converted.csv"
        print(f"Detectado archivo Excel. Convirtiendo a CSV: {csv_convertido}")
        try:
            archivo_entrada = convert_xlsx_to_csv(archivo_entrada, csv_convertido)
        except Exception as e:
            print(f"Error en la conversión: {str(e)}")
            sys.exit(1)
 
    # Asegurar que el directorio de salida existe
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    try:
        resultado = process_extract(archivo_entrada, args.account_type)
        
        # Guardar a archivo con ruta especifica
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(resultado, f, ensure_ascii=False, indent=2)
        
        print(f"Éxito: Archivo guardado en {output_file}")
            
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)
