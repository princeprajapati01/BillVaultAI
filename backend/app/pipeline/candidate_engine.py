from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.pipeline.ocr_correction import CorrectionCandidate, OCRCorrectionLayer


@dataclass
class Candidate:
    field_name: str
    value: Any
    source: str  # regex | spatial | table | positional | nlp | vendor | other
    confidence: float  # 0.0 - 1.0 (normalized)

    # Evidence for ranking (kept optional to avoid touching existing schemas/interfaces)
    raw_value: Optional[str] = None
    ocr_confidence: Optional[float] = None
    box: Optional[tuple] = None  # (x1,y1,x2,y2)
    page_hint: Optional[str] = None
    keyword: Optional[str] = None

    correction: Optional[CorrectionCandidate] = None


@dataclass
class CandidateBundle:
    candidates_by_field: Dict[str, List[Candidate]] = field(default_factory=dict)

    def add(self, c: Candidate) -> None:
        self.candidates_by_field.setdefault(c.field_name, []).append(c)

    def get(self, field_name: str) -> List[Candidate]:
        return self.candidates_by_field.get(field_name, [])


class CandidateEngine:
    """
    Candidate collection engine that aggregates candidates from multiple extraction sources
    without altering existing extraction logic.
    """

    def __init__(self) -> None:
        self.bundle = CandidateBundle()
        self.corrector = OCRCorrectionLayer()

    def add_candidate(
        self,
        field_name: str,
        value: Any,
        *,
        source: str,
        confidence: float,
        raw_value: Optional[str] = None,
        ocr_confidence: Optional[float] = None,
        box: Optional[tuple] = None,
        page_hint: Optional[str] = None,
        keyword: Optional[str] = None,
        enable_correction: bool = True,
        corr = None
        if enable_correction and raw_value is not None:
            corr = self.corrector.correct(field_name, raw_value)

        c = Candidate(
            field_name=field_name,
            value=value,
            source=source,
            confidence=max(0.0, min(1.0, float(confidence))),
            raw_value=raw_value,
            ocr_confidence=ocr_confidence,
            box=box,
            page_hint=page_hint,
            keyword=keyword,
            correction=corr,
        )
        self.bundle.add(c)

    def add_from_classified_dict(
        self,
        classified: Dict[str, Dict[str, Any]],
        *,
        source: str,
        enable_correction: bool = True,
    ) -> None:
        for field_name, info in classified.items():
            if not isinstance(info, dict):
                continue
            if "value" not in info:
                continue
            conf100 = info.get("confidence", 0)
            try:
                conf = float(conf100) / 100.0
            except Exception:
                conf = 0.0
            self.add_candidate(
                field_name,
                info.get("value"),
                source=source,
                confidence=conf,
                raw_value=info.get("source_text"),
                enable_correction=enable_correction,
            )

