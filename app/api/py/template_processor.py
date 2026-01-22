import json
import re
import sys
import argparse
import os
import io
from datetime import datetime

# Force UTF-8 encoding for stdout on Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

MONTH_MAP = {
    'ENE': 1, 'FEB': 2, 'MAR': 3, 'ABR': 4, 'MAY': 5, 'JUN': 6,
    'JUL': 7, 'AGO': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DIC': 12,
    'JAN': 1, 'APR': 4, 'AUG': 8, 'DEC': 12
}

def parse_date(date_str, date_format, year_hint=None):
    """Convert date string to ISO format (YYYY-MM-DD)"""
    date_str = date_str.strip()
    
    # Default year
    year = year_hint or datetime.now().year
    
    try:
        # Handle formats like "DD MMM" or "DD MMM YYYY"
        if 'MMM' in date_format.upper():
            parts = date_str.split()
            day = int(parts[0])
            month_str = parts[1].upper()[:3]
            month = MONTH_MAP.get(month_str, 1)
            if len(parts) > 2:
                year = int(parts[2])
            return f"{year:04d}-{month:02d}-{day:02d}"
        
        # Handle DD/MM/YYYY or DD/MM
        elif '/' in date_str:
            parts = date_str.split('/')
            day = int(parts[0])
            month = int(parts[1])
            if len(parts) > 2:
                year = int(parts[2])
                if year < 100:
                    year += 2000
            return f"{year:04d}-{month:02d}-{day:02d}"
        
        # Handle DD-MM-YYYY
        elif '-' in date_str and len(date_str) > 5:
            parts = date_str.split('-')
            day = int(parts[0])
            month = int(parts[1])
            if len(parts) > 2:
                year = int(parts[2])
                if year < 100:
                    year += 2000
            return f"{year:04d}-{month:02d}-{day:02d}"
        
        # Fallback
        return date_str
    except:
        return date_str

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
    date_format = template.get('date_format', 'DD/MM/YYYY')
    year_hint = template.get('year_hint')
    
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
            
            # Convert date to ISO format
            tx['fecha'] = parse_date(date_raw, date_format, year_hint)
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

def calculate_summary(transactions, account_type='debit'):
    """Calculate totals from transactions"""
    total_abonos = 0.0
    total_cargos = 0.0
    
    for tx in transactions:
        if tx.get('ignored', False):
            continue
        val = tx.get('valor', 0)
        if val > 0:
            total_abonos += val
        else:
            total_cargos += abs(val)
    
    # For credit cards, saldo_actual is just the total charges
    if account_type == 'credit':
        saldo_actual = -total_cargos
    else:
        saldo_actual = total_abonos - total_cargos
    
    return {
        'saldo_actual': round(saldo_actual, 2),
        'total_abonos': round(total_abonos, 2),
        'total_cargos': round(total_cargos, 2)
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Procesador Universal de Templates')
    parser.add_argument('--text', type=str, required=True, help='Ruta al archivo de texto')
    parser.add_argument('--template', type=str, required=True, help='Ruta al archivo JSON del template')
    
    args = parser.parse_args()
    
    try:
        with open(args.template, 'r', encoding='utf-8') as f:
            template = json.load(f)
            
        with open(args.text, 'r', encoding='utf-8') as f:
            raw_text = f.read()
            
        transactions = process_with_template(raw_text, template)
        account_type = template.get('account_type', 'debit')
        summary = calculate_summary(transactions, account_type)
        
        # Output result as JSON to stdout
        print(json.dumps({
            "meta_info": {
                "banco": template.get('entity', 'Desconocido'),
                "tipo_cuenta": account_type,
                "resumen": summary
            },
            "transacciones": transactions,
            "template_config": template
        }, indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

