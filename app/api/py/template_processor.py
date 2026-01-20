import json
import re
import sys
import argparse
import os

def parse_currency(value_str, dec='.', thou=','):
    if not value_str: return 0.0
    clean = re.sub(r'[^\d,.+-]', '', value_str)
    
    # Move trailing sign
    if clean.endswith('+') or clean.endswith('-'):
        clean = clean[-1] + clean[:-1]
    
    # Use template separators if provided
    if dec == ',' and thou == '.':
        clean = clean.replace('.', '').replace(',', '.')
    elif dec == '.' and thou == ',':
        clean = clean.replace(',', '')
    else:
        # Fallback to smart detection
        if ',' in clean and '.' in clean:
            if clean.rfind(',') > clean.rfind('.'): clean = clean.replace('.', '').replace(',', '.')
            else: clean = clean.replace(',', '')
        elif ',' in clean:
            if len(clean.split(',')[-1]) <= 2: clean = clean.replace(',', '.')
            else: clean = clean.replace(',', '')
        elif '.' in clean:
            parts = clean.split('.')
            if len(parts) > 2 or len(parts[-1]) == 3: clean = clean.replace('.', '')
            
    try:
        return float(clean)
    except:
        return 0.0

def process_with_template(text, template):
    rules = template.get('rules', {})
    regex = template.get('transaction_regex')
    mapping = template.get('group_mapping', {})
    dec_sep = template.get('decimal_separator', ',')
    thou_sep = template.get('thousand_separator', '.')
    
    if not regex or not mapping:
        raise Exception("Template incompleto: falta regex o mapeo")

    transactions = []
    pattern = re.compile(regex, re.MULTILINE)
    
    # Extra rules
    default_negative = rules.get('default_negative', False)
    pos_patterns = rules.get('positive_patterns', [])
    ignore_patterns = rules.get('ignore_patterns', [])

    matches = pattern.finditer(text)
    for match in matches:
        tx = {}
        try:
            date_raw = match.group(mapping.get('date', 1))
            desc_raw = match.group(mapping.get('description', 2)).strip()
            val_raw = match.group(mapping.get('value', 3))
            
            tx['fecha'] = date_raw.strip()
            tx['descripcion'] = desc_raw
            
            val = parse_currency(val_raw, dec_sep, thou_sep)
            
            # Apply sign logic
            is_positive = False
            for p in pos_patterns:
                if re.search(p, desc_raw, re.IGNORECASE):
                    is_positive = True
                    break
            
            if default_negative and not is_positive and val > 0:
                val = -val
            elif is_positive and val < 0:
                val = abs(val)
                
            tx['valor'] = val
            
            # Apply ignore logic
            is_ignored = False
            for p in ignore_patterns:
                if re.search(p, desc_raw, re.IGNORECASE):
                    is_ignored = True
                    break
            tx['ignored'] = is_ignored
            
            transactions.append(tx)
        except Exception as e:
            continue

    return transactions

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Procesador Universal de Templates')
    parser.add_argument('--text', type=str, required=True, help='Texto del extracto')
    parser.add_argument('--template', type=str, required=True, help='Ruta al archivo JSON del template')
    
    args = parser.parse_args()
    
    try:
        with open(args.template, 'r', encoding='utf-8') as f:
            template = json.load(f)
            
        with open(args.text, 'r', encoding='utf-8') as f:
            raw_text = f.read()
            
        transactions = process_with_template(raw_text, template)
        
        # Output result as JSON to stdout
        print(json.dumps({
            "meta_info": {
                "banco": template.get('entity', 'Desconocido'),
                "tipo_cuenta": template.get('account_type', 'debit'),
                "resumen": {
                    "saldo_actual": 0,
                    "total_abonos": 0,
                    "total_cargos": 0
                }
            },
            "transacciones": transactions
        }, indent=2))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
