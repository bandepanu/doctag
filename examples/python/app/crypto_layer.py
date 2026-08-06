"""Toy crypto stub so the example imports + doctests run. Not real crypto."""


def validate_hash(s_token: str) -> bool:
    """Deterministic placeholder signature check.

    >>> validate_hash("valid_signature")
    True
    >>> validate_hash("nope")
    False
    """
    return bool(s_token) and s_token.startswith("valid")
