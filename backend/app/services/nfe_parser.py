from datetime import date, datetime
from decimal import Decimal
from typing import Optional

import defusedxml.ElementTree as ET
from xml.etree.ElementTree import Element

from app.schemas.nfe import NFeItemParsed, NFeParcelaParsed, NFeParsedData


NFE_NS = "{http://www.portalfiscal.inf.br/nfe}"


class NFeParserError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(f"{code}: {message}")


def _find(elem: Element, path: str) -> Optional[Element]:
    """Find with NF-e namespace prepended to each path segment."""
    parts = path.split("/")
    ns_path = "/".join(f"{NFE_NS}{p}" for p in parts)
    return elem.find(ns_path)


def _findall(elem: Element, path: str) -> list[Element]:
    parts = path.split("/")
    ns_path = "/".join(f"{NFE_NS}{p}" for p in parts)
    return elem.findall(ns_path)


def _text(elem: Optional[Element]) -> Optional[str]:
    return elem.text.strip() if elem is not None and elem.text else None


def _required_text(elem: Element, path: str, code: str = "MISSING_FIELDS") -> str:
    target = _find(elem, path)
    value = _text(target)
    if value is None:
        raise NFeParserError(code, f"Campo obrigatório ausente: {path}")
    return value


def parse_nfe_xml(xml_bytes: bytes) -> NFeParsedData:
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as e:
        raise NFeParserError("INVALID_XML", "Arquivo XML inválido") from e

    tag = root.tag
    if tag == f"{NFE_NS}nfeProc":
        nfe_node = _find(root, "NFe")
        prot_node = _find(root, "protNFe")
    elif tag == f"{NFE_NS}NFe":
        nfe_node = root
        prot_node = None
    else:
        raise NFeParserError("NOT_NFE", "Arquivo não é uma NF-e")

    if nfe_node is None:
        raise NFeParserError("NOT_NFE", "Arquivo não é uma NF-e")

    inf_nfe = _find(nfe_node, "infNFe")
    if inf_nfe is None:
        raise NFeParserError("NOT_NFE", "Arquivo não é uma NF-e")

    modelo = _required_text(inf_nfe, "ide/mod")
    if modelo != "55":
        raise NFeParserError(
            "UNSUPPORTED_MODEL",
            "Apenas NF-e modelo 55 é suportada",
        )

    if prot_node is not None:
        c_stat = _text(_find(prot_node, "infProt/cStat"))
        if c_stat != "100":
            raise NFeParserError(
                "NOT_AUTHORIZED",
                f"NF-e não autorizada (status {c_stat})",
            )

    if prot_node is not None:
        chave = _text(_find(prot_node, "infProt/chNFe"))
    else:
        chave = None
    if not chave:
        inf_id = inf_nfe.get("Id", "")
        chave = inf_id[3:] if inf_id.startswith("NFe") else inf_id
    if not chave or len(chave) != 44:
        raise NFeParserError("MISSING_FIELDS", "Chave de acesso não encontrada")

    numero = _required_text(inf_nfe, "ide/nNF")
    serie = _text(_find(inf_nfe, "ide/serie")) or ""

    dh_emi = _required_text(inf_nfe, "ide/dhEmi")
    data_emissao = datetime.fromisoformat(dh_emi).date()

    v_nf = _required_text(inf_nfe, "total/ICMSTot/vNF")
    valor_total = Decimal(v_nf)

    cnpj = _required_text(inf_nfe, "emit/CNPJ")
    nome = _required_text(inf_nfe, "emit/xNome")
    fantasia = _text(_find(inf_nfe, "emit/xFant"))
    email = _text(_find(inf_nfe, "emit/email"))

    dest_cnpj_cpf = _text(_find(inf_nfe, "dest/CNPJ")) or _text(_find(inf_nfe, "dest/CPF"))
    dest_nome = _text(_find(inf_nfe, "dest/xNome"))
    dest_email = _text(_find(inf_nfe, "dest/email"))

    parcelas: list[NFeParcelaParsed] = []
    for dup in _findall(inf_nfe, "cobr/dup"):
        n = _text(_find(dup, "nDup")) or ""
        d = _text(_find(dup, "dVenc"))
        v = _text(_find(dup, "vDup"))
        if d and v:
            parcelas.append(
                NFeParcelaParsed(
                    numero=n,
                    vencimento=date.fromisoformat(d),
                    valor=Decimal(v),
                )
            )

    itens: list[NFeItemParsed] = []
    for det in _findall(inf_nfe, "det"):
        prod = _find(det, "prod")
        if prod is None:
            continue
        descr = _text(_find(prod, "xProd")) or ""
        qtd = _text(_find(prod, "qCom")) or "0"
        vprod = _text(_find(prod, "vProd")) or "0"
        itens.append(
            NFeItemParsed(
                descricao=descr,
                quantidade=Decimal(qtd),
                valor_total=Decimal(vprod),
            )
        )

    return NFeParsedData(
        chave_acesso=chave,
        numero_nota=numero,
        serie=serie,
        modelo=modelo,
        data_emissao=data_emissao,
        valor_total=valor_total,
        emitente_cnpj=cnpj,
        emitente_nome=nome,
        emitente_fantasia=fantasia,
        emitente_email=email,
        dest_cnpj_cpf=dest_cnpj_cpf,
        dest_nome=dest_nome,
        dest_email=dest_email,
        parcelas=parcelas,
        itens=itens,
    )
