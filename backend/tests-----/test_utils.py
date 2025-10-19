import utils


def test_normalize_school_item_extracts_expected_fields():
    item = {
        "Nome": "EMEF Paulo Freire",
        "logradouro": "Rua das Flores",
        "numero": "123",
        "dre": "DRE Butanta",
    }

    normalized = utils.normalize_school_item(item)

    assert normalized["nome"] == "EMEF Paulo Freire"
    assert normalized["endereco"] == "Rua das Flores"
    assert normalized["numero"] == "123"
    assert normalized["dre"] == "DRE Butanta"
    assert normalized["raw"] == item


def test_normalize_school_item_handles_non_dict():
    normalized = utils.normalize_school_item(None)
    assert normalized == {"nome": None, "endereco": None, "numero": None, "dre": None, "raw": None}


def test_best_match_returns_highest_score():
    candidates = [
        {"nome": "EMEF Jose Bonifacio"},
        {"nome": "CEI Primeiros Passos"},
        {"nome": "EMEI Monteiro Lobato"},
    ]

    best = utils.best_match("EMEI Monteiro Lobato", candidates)

    assert best == {"nome": "EMEI Monteiro Lobato"}
