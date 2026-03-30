import json
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from app.models.user import User
from app.services.auth import get_current_user, require_administrator

router = APIRouter(prefix="/api/templates", tags=["テンプレート管理"])

TEMPLATES_DIR = Path(__file__).parents[2] / "static" / "templates"
VERSIONS_FILE = TEMPLATES_DIR / "template_versions.json"


def _load_versions() -> list[dict]:
    if not VERSIONS_FILE.exists():
        return []
    return json.loads(VERSIONS_FILE.read_text(encoding="utf-8"))


def _save_versions(versions: list[dict]) -> None:
    VERSIONS_FILE.write_text(
        json.dumps(versions, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _bump_version(version: str) -> str:
    """パッチバージョンをインクリメント（例: 1.0.2 → 1.0.3）"""
    parts = version.split(".")
    parts[-1] = str(int(parts[-1]) + 1)
    return ".".join(parts)


@router.get("/")
def list_templates(
    _: User = Depends(get_current_user),
):
    """テンプレート一覧（全ロール）"""
    return _load_versions()


@router.get("/{template_id}/download")
def download_template(
    template_id: str,
    _: User = Depends(get_current_user),
):
    """テンプレートファイルダウンロード（全ロール）"""
    versions = _load_versions()
    entry = next((v for v in versions if v["id"] == template_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="テンプレートが見つかりません")

    file_path = TEMPLATES_DIR / entry["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="ファイルが見つかりません")

    return FileResponse(
        path=str(file_path),
        filename=entry["filename"],
        media_type="text/csv",
    )


@router.put("/{template_id}")
async def update_template(
    template_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(require_administrator),
):
    """テンプレートファイル更新（管理者のみ）"""
    versions = _load_versions()
    idx = next((i for i, v in enumerate(versions) if v["id"] == template_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="テンプレートが見つかりません")

    entry = versions[idx]
    content = await file.read()

    # ファイル保存
    file_path = TEMPLATES_DIR / entry["filename"]
    file_path.write_bytes(content)

    # バージョン更新
    versions[idx] = {
        **entry,
        "version": _bump_version(entry["version"]),
        "updated_at": date.today().isoformat(),
    }
    _save_versions(versions)

    return versions[idx]
