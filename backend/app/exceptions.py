class AppError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class ExternalServiceError(AppError):
    """OpenAI or other external API failures."""
    def __init__(self, service: str, detail: str = ""):
        msg = f"{service} service error"
        if detail:
            msg += f": {detail}"
        super().__init__(msg, status_code=502)


class ContentExtractionError(AppError):
    """Failed to extract text from a URL."""
    def __init__(self, url: str, detail: str = ""):
        super().__init__(f"Failed to extract content from {url}: {detail}", status_code=422)


class ValidationError(AppError):
    """Input validation beyond Pydantic defaults."""
    def __init__(self, detail: str):
        super().__init__(detail, status_code=422)


class RateLimitError(AppError):
    """External rate limit hit."""
    def __init__(self, service: str = "API"):
        super().__init__(f"{service} rate limit exceeded. Please wait a moment and try again.", status_code=429)
