import csv
import json
import sys
import os

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

def process_extract(file_path):
    # Estructura base del JSON resultante
    data = {
        "meta_info": {
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
    archivo_entrada = "Extracto/Bancolombia/Extracto_202512_Cuentas_de ahorro_7666.csv"
    output_dir = "Extracto/Bancolombia/procesado_bancolombia"
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        resultado = process_extract(archivo_entrada)
        
        # Imprimir JSON resultante
        print(json.dumps(resultado, ensure_ascii=False, indent=2))
        
        # Guardar a archivo con ruta especifica
        output_file = os.path.join(output_dir, "extracto_procesado.json")
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(resultado, f, ensure_ascii=False, indent=2)
        print(f"Archivo guardado en: {output_file}")
            
    except FileNotFoundError:
        print(f"Error: No se encontró el archivo {archivo_entrada}")