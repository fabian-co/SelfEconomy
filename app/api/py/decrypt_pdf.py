import pikepdf
import sys
import os
import argparse

def decrypt_pdf(input_path, output_path, password=None):
    try:
        # If no password is provided, pikepdf will try to open it without one
        with pikepdf.open(input_path, password=password if password else "") as pdf:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            pdf.save(output_path)
        print(f"Éxito: PDF decriptado en {output_path}")
    except pikepdf.PasswordError:
        print("PASSWORD_REQUIRED", file=sys.stderr)
        sys.exit(10)
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Decriptador de PDFs')
    parser.add_argument('--input', type=str, required=True, help='Ruta al PDF original')
    parser.add_argument('--output', type=str, required=True, help='Ruta al PDF de salida (sin contraseña)')
    parser.add_argument('--password', type=str, help='Contraseña del PDF')
    
    args = parser.parse_args()
    decrypt_pdf(args.input, args.output, args.password)
