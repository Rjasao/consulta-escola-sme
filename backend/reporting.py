import json
import logging
import os
from typing import Any, Dict, List, Optional

try:
    import pythoncom
    import win32com.client  # type: ignore
except ImportError:
    pythoncom = None
    win32com = None  # type: ignore

LOGGER = logging.getLogger(__name__)

UNIT_RANGES = ["E23", "E25", "E27", "E29"]
USER_RANGES = [
    ("E6", "V6", "AB6"),
    ("E8", "V8", "AB8"),
    ("E10", "V10", "AB10"),
    ("E12", "V12", "AB12"),
]


def _ensure_com_available() -> None:
    if pythoncom is None or win32com is None:
        raise RuntimeError("pywin32 nao esta instalado no ambiente atual.")


def _compose_unit_line(item: Dict[str, Any]) -> str:
    def _get(*keys: str) -> str:
        for key in keys:
            if not key:
                continue
            value = item.get(key)
            if value:
                return str(value).strip()
        return ""

    tipo = _get("tipo", "tipoesc")
    rede = _get("rede")
    nome = _get("nome", "nomesc")
    endereco = _get("endereco", "rua", "logradouro")
    numero = _get("numero", "num", "nro")
    bairro = _get("bairro")
    dre = _get("dre", "dres", "DREs", "DRE")

    header_parts = [tipo, rede, nome]
    header = " ".join([part for part in header_parts if part]).strip()

    address = endereco
    if numero:
        address = f"{address}, {numero}" if address else numero

    bairro_dre = ""
    if bairro and dre:
        bairro_dre = f"{bairro} / {dre}"
    elif bairro:
        bairro_dre = bairro
    elif dre:
        bairro_dre = f"/ {dre}"

    segments: List[str] = []
    if header:
        segments.append(header)
    if address:
        segments.append(address)
    if bairro_dre and not any(bairro_dre in segment for segment in segments):
        segments.append(bairro_dre)

    return " - ".join(segments).strip()


def _safe_str(value: Optional[Any]) -> str:
    if value is None:
        return ""
    return str(value).strip()


def update_ficha_and_export(
    json_path: str,
    workbook_path: str,
    pdf_output_path: str,
    sheet_name: str = "pla_ficha",
) -> None:
    """
    Carrega dados do pdf.json e atualiza a planilha, exportando PDF.
    """
    _ensure_com_available()

    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Arquivo JSON nao encontrado: {json_path}")
    if not os.path.exists(workbook_path):
        raise FileNotFoundError(f"Modelo Excel nao encontrado: {workbook_path}")

    with open(json_path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)

    unidades = payload.get("unidades") or []
    usuarios = payload.get("usuarios") or []

    data_saida = _safe_str(payload.get("data_saida"))
    hora_saida = _safe_str(payload.get("hora_saida"))
    hora_retorno = _safe_str(payload.get("hora_retorno"))
    justificativa = _safe_str(payload.get("justificativa"))
    observacoes = _safe_str(payload.get("observacoes"))

    pythoncom.CoInitialize()
    excel = win32com.client.DispatchEx("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False

    try:
        workbook = excel.Workbooks.Open(os.path.abspath(workbook_path))
        try:
            worksheet = workbook.Worksheets(sheet_name)
        except Exception as exc:
            workbook.Close(SaveChanges=False)
            raise RuntimeError(f"A planilha '{sheet_name}' nao foi encontrada.") from exc

        # Unidades
        for idx, cell_ref in enumerate(UNIT_RANGES):
            value = ""
            if idx < len(unidades) and isinstance(unidades[idx], dict):
                value = _compose_unit_line(unidades[idx])
            worksheet.Range(cell_ref).Value = value

        # Usuarios
        for idx, cell_group in enumerate(USER_RANGES):
            nome_cell, rf_cell, tel_cell = cell_group
            nome = rf = telefone = ""
            if idx < len(usuarios) and isinstance(usuarios[idx], dict):
                item = usuarios[idx]
                nome = _safe_str(item.get("nome"))
                rf = _safe_str(item.get("rf"))
                telefone = _safe_str(item.get("telefone"))
            worksheet.Range(nome_cell).Value = nome
            worksheet.Range(rf_cell).Value = "RF: " + rf
            worksheet.Range(tel_cell).Value = "Tel: " + telefone

        # Campos adicionais
        worksheet.Range("J18").Value = data_saida
        worksheet.Range("J19").Value = hora_saida
        worksheet.Range("J21").Value = hora_retorno
        worksheet.Range("A34").Value = justificativa
        worksheet.Range("A36").Value = observacoes

        percurso_val = _safe_str(payload.get("percurso")).lower()
        ida_volta = "(    ) IDA E VOLTA"
        so_ida = "(    ) SO IDA"
        so_volta = "(    ) SO VOLTA"

        if percurso_val == "ida_volta":
            ida_volta = "( X ) IDA E VOLTA"
        elif percurso_val == "so_ida":
            so_ida = "( X ) SO IDA"
        elif percurso_val == "so_volta":
            so_volta = "( X ) SO VOLTA"

        worksheet.Range("A16").Value = ida_volta
        worksheet.Range("L16").Value = so_ida
        worksheet.Range("W16").Value = so_volta

        workbook.Save()

        pdf_abs_path = os.path.abspath(pdf_output_path)
        pdf_dir = os.path.dirname(pdf_abs_path)
        os.makedirs(pdf_dir, exist_ok=True)
        workbook.ExportAsFixedFormat(0, pdf_abs_path)
        workbook.Close(SaveChanges=True)
    finally:
        excel.Quit()
        pythoncom.CoUninitialize()
