import sys
import os
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

# Ensure api directory is in sys.path for resilient imports
api_dir = os.path.dirname(os.path.abspath(__file__))
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

try:
    from services.web3_service import Web3Service
except ImportError:
    from api.services.web3_service import Web3Service

app = FastAPI(
    title="ChainCert Web3 Service Gateway",
    description="Enterprise-grade Academic Credential Verification backend relay interfacing Ethereum.",
    version="1.0.0"
)

# CORS configurations for frontend dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the Web3 Service
web3_service = Web3Service()

# --- Pydantic Schemas ---
class CertificateBase(BaseModel):
    student_name: str = Field(..., example="Alice Johnson")
    degree_name: str = Field(..., example="Bachelor of Science")
    major: str = Field(..., example="Computer Science")
    institution: str = Field(..., example="State University")

class CertificateIssueInput(CertificateBase):
    pass

class HashResultResponse(BaseModel):
    hash: str
    metadata: CertificateBase

class IssueResultResponse(BaseModel):
    status: str
    transaction_hash: Optional[str] = None
    certificate_hash: str
    block_number: Optional[int] = None
    message: Optional[str] = None

class RevokeInput(BaseModel):
    certificate_hash: str = Field(..., example="0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addad20012efd9f")

class VerificationResponse(BaseModel):
    verified: bool
    student_name: Optional[str] = None
    degree_name: Optional[str] = None
    major: Optional[str] = None
    issue_date: Optional[int] = None
    institution: Optional[str] = None
    status_code: str
    message: Optional[str] = None

# --- Endpoints ---

@app.get("/")
def read_root():
    """
    Health check and connection diagnostics.
    """
    connection_info = web3_service.get_network_info()
    return {
        "app": "ChainCert API Gateway",
        "status": "online",
        "blockchain": connection_info
    }

@app.post("/api/v1/certificates/hash", response_model=HashResultResponse)
def compute_certificate_hash(payload: CertificateBase):
    """
    Computes a unique, deterministic SHA-256 certificate hash based on certificate details.
    """
    try:
        cert_hash = web3_service.compute_hash(
            student_name=payload.student_name,
            degree_name=payload.degree_name,
            major=payload.major,
            institution=payload.institution
        )
        return HashResultResponse(hash=cert_hash, metadata=payload)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Hashing failed: {str(e)}"
        )

@app.post("/api/v1/certificates/issue", response_model=IssueResultResponse)
def issue_certificate(payload: CertificateIssueInput):
    """
    Computes hash and registers the certificate on the blockchain.
    """
    try:
        # 1. Compute hash deterministically
        cert_hash = web3_service.compute_hash(
            student_name=payload.student_name,
            degree_name=payload.degree_name,
            major=payload.major,
            institution=payload.institution
        )
        
        # 2. Transact on blockchain
        result = web3_service.issue_certificate(
            cert_hash_hex=cert_hash,
            name=payload.student_name,
            degree=payload.degree_name,
            major=payload.major,
            institution=payload.institution
        )
        
        return IssueResultResponse(
            status=result["status"],
            transaction_hash=result.get("transaction_hash"),
            certificate_hash=result["certificate_hash"],
            block_number=result.get("block_number"),
            message=result.get("message")
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Blockchain transaction failed: {str(e)}"
        )

@app.post("/api/v1/certificates/revoke")
def revoke_certificate(payload: RevokeInput):
    """
    Revokes an existing credential on the blockchain.
    Only the university admin owner signature will succeed.
    """
    try:
        result = web3_service.revoke_certificate(payload.certificate_hash)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Revocation transaction failed: {str(e)}"
        )

@app.get("/api/v1/certificates/verify/{cert_hash}", response_model=VerificationResponse)
def verify_certificate(cert_hash: str):
    """
    Verifies a certificate's integrity and validity status directly on-chain by its hash.
    """
    if not (cert_hash.startswith("0x") and len(cert_hash) == 66):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid hash format. Must be a 32-byte hexadecimal string starting with '0x'."
        )
    
    try:
        result = web3_service.verify_certificate(cert_hash)
        return VerificationResponse(**result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification lookup failed: {str(e)}"
        )
