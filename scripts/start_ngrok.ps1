# Ejecuta el servidor Flask y ngrok en paralelo
# DRAW 2.0.1 - AIRpipe

# 1. Iniciar Flask en una nueva ventana (con log)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python app.py > flask_server.log 2>&1"

# 2. Iniciar ngrok en otra ventana (forzando IPv4)
Start-Process ngrok -ArgumentList "http 127.0.0.1:5000"

Write-Host "----------------------------------------------------"
Write-Host "AIRpipe DRAW 2.0.1 - Acceso Remoto"
Write-Host "1. Flask se está iniciando en el puerto 5000."
Write-Host "2. ngrok está abriendo el túnel."
Write-Host "Busca la URL 'Forwarding' en la ventana de ngrok."
Write-Host "----------------------------------------------------"
