import pikepdf
import sys
import os
import argparse

def remove_pdf_password(input_path, output_path, password=None):
    """
    Remove password protection from a PDF file.
    Creates an unprotected copy of the PDF.
    """
    try:
        # Open the PDF with password if provided
        pdf = pikepdf.open(input_path, password=password or "")
        
        # Save without encryption
        pdf.save(output_path)
        pdf.close()
        
        print(f"SUCCESS: Unprotected PDF saved to {output_path}")
        return True
        
    except pikepdf.PasswordError:
        print("PASSWORD_REQUIRED", file=sys.stderr)
        sys.exit(10)
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Remove PDF password protection')
    parser.add_argument('--input', type=str, required=True, help='Path to the protected PDF')
    parser.add_argument('--password', type=str, help='Password for the PDF')
    parser.add_argument('--output', type=str, required=True, help='Path for the unprotected PDF output')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input):
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)
    
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    remove_pdf_password(args.input, args.output, args.password)
