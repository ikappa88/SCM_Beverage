"""
定期バッチスケジューラ

APScheduler を使い、5分ごとに全在庫のアラートを評価する。
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.database import SessionLocal
from app.services.alert_service import evaluate_all_inventories

logger = logging.getLogger(__name__)

_scheduler = BackgroundScheduler()


def _run_alert_evaluation() -> None:
    db = SessionLocal()
    try:
        count = evaluate_all_inventories(db)
        db.commit()
        logger.info("定期アラート評価完了: %d 件処理", count)
    except Exception:
        db.rollback()
        logger.exception("定期アラート評価でエラーが発生しました")
    finally:
        db.close()


def start_scheduler() -> None:
    _scheduler.add_job(
        _run_alert_evaluation,
        trigger="interval",
        minutes=5,
        id="alert_evaluation",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("アラート評価スケジューラを開始しました（5分間隔）")


def stop_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown()
        logger.info("アラート評価スケジューラを停止しました")
