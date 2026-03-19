from fpdf import FPDF
pdf = FPDF()
pdf.add_page()
pdf.set_font('Arial', 'B', 16)
pdf.cell(40, 10, 'Hello World!')
content = pdf.output(dest='S')
print(f"Type: {type(content)}")
try:
    # See if it's encoded or raw
    print(f"Length: {len(content)}")
    if isinstance(content, str):
        content_bytes = content.encode('latin-1')
        print(f"Encoded length: {len(content_bytes)}")
except Exception as e:
    print(f"Error: {e}")
