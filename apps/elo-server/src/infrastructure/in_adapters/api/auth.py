from fastapi import Request, HTTPException, status
import os

async def verify_token(request: Request):
    """
    Verifies the authentication token for API requests.
    Supports either Authorization header (Bearer token) or X-API-Key header.
    If no token is configured in the environment, it strictly denies access.
    """
    # Using os.getenv here allows picking it up immediately without circular imports
    expected_token = os.getenv("SERVER_AUTH_TOKEN")
    
    if not expected_token:
        # Strict mode: If no token is configured, the server should reject the request.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server is missing the SERVER_AUTH_TOKEN configuration. Authentication cannot be bypassed.",
        )
        
    auth_header = request.headers.get("Authorization")
    api_key_header = request.headers.get("X-API-Key")
    
    provided_token = None
    if auth_header and auth_header.startswith("Bearer "):
        provided_token = auth_header[7:]
    elif api_key_header:
        provided_token = api_key_header
        
    if not provided_token or provided_token != expected_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    return True
