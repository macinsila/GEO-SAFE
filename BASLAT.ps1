$root = "c:\Users\90543\OneDrive\Desktop\geosafe2 kişisel"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$root\.venv\Scripts\Activate.ps1'; cd '$root\backend'; uvicorn app.main:app --reload"

Start-Sleep 4

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm start"

Start-Sleep 6

Start-Process "http://localhost:3000"