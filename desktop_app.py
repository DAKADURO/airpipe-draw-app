import threading
import time
import sys
import os
import webbrowser

# Intentamos importar webview, si falla usaremos el navegador normal
try:
    import webview
    HAS_WEBVIEW = True
except ImportError:
    HAS_WEBVIEW = False

# Aseguramos que el directorio actual sea el de la aplicación
if getattr(sys, 'frozen', False):
    application_path = sys._MEIPASS
else:
    application_path = os.path.dirname(os.path.abspath(__file__))

os.chdir(application_path)

from app import app

def start_server():
    # Flask app en modo produccion
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)

if __name__ == '__main__':
    # Iniciamos Flask en un hilo secundario
    server_thread = threading.Thread(target=start_server)
    server_thread.daemon = True
    server_thread.start()
    
    # Damos tiempo para que el servidor Flask inicie
    time.sleep(1.5)
    
    url = 'http://127.0.0.1:5000'
    
    if HAS_WEBVIEW:
        print("Iniciando ventana nativa...")
        webview.create_window('AIRpipe DRAW', url, width=1280, height=800)
        webview.start()
    else:
        print("PyWebView no disponible. Abriendo en el navegador por defecto...")
        webbrowser.open(url)
        # En este modo, mantenemos el proceso vivo mientras el servidor corra
        try:
            while True:
                time.sleep(100)
        except KeyboardInterrupt:
            print("Cerrando aplicacion...")
