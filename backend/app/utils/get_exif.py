from __future__ import annotations

from fractions import Fraction
from pathlib import Path

from PIL import Image
from PIL.ExifTags import GPSTAGS, TAGS

from app.core import logger

_EXIF_IFD = 0x8769
_GPS_IFD = 0x8825


def _frac_to_str(value) -> str | None:
    """IFDRational/float 曝光时间 → "1/N" 或 "X" 形式字符串。"""
    if value is None:
        return None
    try:
        frac = Fraction(str(float(value))).limit_denominator(100000)
    except (TypeError, ValueError, ZeroDivisionError):
        return None
    if frac == 0:
        return None
    # 小于 1 的曝光时间显示为 1/N(如 0.0037 → 1/269)
    if frac < 1:
        return f"1/{frac.denominator}"
    # 整数秒
    if frac.denominator == 1:
        return f"{frac.numerator}s"
    return f"{frac.numerator}/{frac.denominator}s"


def _gps_to_decimal(values: tuple, ref: str) -> float | None:
    """度分秒 + 方向 → 十进制经纬度。"""
    if not values or len(values) < 3:
        return None
    try:
        d, m, s = (float(v) for v in values[:3])
    except (TypeError, ValueError):
        return None
    decimal = d + m / 60 + s / 3600
    if ref in ("S", "W"):
        decimal = -decimal
    return round(decimal, 6)


def _build_friendly(exif: Image.Exif) -> dict:
    """从 PIL Exif 提取结构化、前端友好的字段。

    仅暴露详情页需要的字段,丢弃 MakerNote 等大二进制与指针型条目。
    """
    out: dict = {}
    make = exif.get(TAGS.get("Make")) or exif.get(0x010F)
    model = exif.get(TAGS.get("Model")) or exif.get(0x0110)
    make_str = str(make).strip() if make else ""
    model_str = str(model).strip() if model else ""
    camera = " ".join(p for p in (make_str, model_str) if p).strip()
    if camera:
        out["camera"] = camera

    exif_ifd = exif.get_ifd(_EXIF_IFD) if hasattr(exif, "get_ifd") else {}

    lens_model = exif_ifd.get(TAGS.get("LensModel") or 0xA434)
    if lens_model:
        out["lens"] = str(lens_model).strip()

    iso = exif_ifd.get(TAGS.get("ISOSpeedRatings") or 0x8827)
    if iso is not None and str(iso) != "0":
        out["iso"] = int(iso)

    exposure = exif_ifd.get(TAGS.get("ExposureTime") or 0x829A)
    if exposure is not None:
        out["exposure"] = _frac_to_str(exposure)

    fnumber = exif_ifd.get(TAGS.get("FNumber") or 0x829D)
    if fnumber is not None and float(fnumber) > 0:
        out["aperture"] = f"f/{float(fnumber):g}"

    focal = exif_ifd.get(TAGS.get("FocalLength") or 0x920A)
    if focal is not None and float(focal) > 0:
        out["focalLength"] = f"{float(focal):g}mm"

    focal35 = exif_ifd.get(TAGS.get("FocalLengthIn35mmFilm") or 0xA405)
    if focal35 is not None and str(focal35) != "0":
        out["focalLength35"] = f"{int(focal35)}mm"

    taken_at = exif_ifd.get(TAGS.get("DateTimeOriginal") or 0x9003)
    if taken_at:
        out["takenAt"] = str(taken_at)

    gps_ifd = exif.get_ifd(_GPS_IFD) if hasattr(exif, "get_ifd") else {}
    lat = _gps_to_decimal(
        gps_ifd.get(GPSTAGS.get("GPSLatitude") or 0x0002),
        str(gps_ifd.get(GPSTAGS.get("GPSLatitudeRef") or 0x0001, "")),
    )
    lng = _gps_to_decimal(
        gps_ifd.get(GPSTAGS.get("GPSLongitude") or 0x0004),
        str(gps_ifd.get(GPSTAGS.get("GPSLongitudeRef") or 0x0003, "")),
    )
    if lat is not None and lng is not None:
        out["gps"] = {"lat": lat, "lng": lng}

    return out


def get_exif_data(path: Path) -> dict:
    """读取图片 EXIF,返回结构化、JSON 可序列化的 dict。

    输出前端友好字段(camera/lens/iso/exposure/aperture/
    focalLength/focalLength35/takenAt/gps),丢弃 MakerNote 等无用二进制。
    """
    try:
        with Image.open(path) as img:
            exif = img.getexif()
            if not exif:
                return {}
            data = _build_friendly(exif)
    except Exception:
        logger.bind(path=str(path)).exception("failed to read exif")
        return {}

    # 日志只记字段名,不记 EXIF 值(避免 GPS/拍摄信息进明文日志)
    logger.bind(keys=sorted(data.keys())).info("exif data")
    return data
