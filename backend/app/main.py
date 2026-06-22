import os
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.routers import auth, people, appointments, todos, grocery

app = FastAPI(title="family-hub")
app.include_router(auth.router)
app.include_router(people.router)
app.include_router(appointments.router)
app.include_router(todos.router)
app.include_router(grocery.router)

@app.get("/healthz")
def healthz():
    return {"status": "ok"}

_STATIC = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.isdir(_STATIC):
    app.mount("/assets", StaticFiles(directory=os.path.join(_STATIC, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        # serve index.html for any non-API path so client-side routing works
        return FileResponse(os.path.join(_STATIC, "index.html"))
