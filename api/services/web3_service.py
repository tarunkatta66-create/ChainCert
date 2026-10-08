import os
import json
import hashlib
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

# Path to the contract_info.json file
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
CONTRACT_INFO_PATH = os.path.join(CURRENT_DIR, "../contract_info.json")

class Web3Service:
    def __init__(self):
        # Local JSON-RPC provider (Hardhat Node)
        self.provider_url = os.getenv("WEB3_PROVIDER_URL", "http://127.0.0.1:8545")
        self.w3 = Web3(Web3.HTTPProvider(self.provider_url))
        
        self.contract = None
        self.admin_address = None
        self.private_key = os.getenv("UNIVERSITY_ADMIN_PRIVATE_KEY")

        # Initialize contract if contract_info exists
        self.load_contract()

    def load_contract(self):
        if not os.path.exists(CONTRACT_INFO_PATH):
            print(f"Warning: contract_info.json not found at {CONTRACT_INFO_PATH}. Please deploy the contract first.")
            return False

        try:
            with open(CONTRACT_INFO_PATH, "r") as f:
                contract_info = json.load(f)
            
            self.contract_address = self.w3.to_checksum_address(contract_info["address"])
            self.contract_abi = contract_info["abi"]
            self.contract = self.w3.eth.contract(address=self.contract_address, abi=self.contract_abi)
            
            # Setup university admin account
            if self.private_key:
                # If private key is configured, derive address
                account = self.w3.eth.account.from_key(self.private_key)
                self.admin_address = account.address
                print(f"Using configured Admin Address: {self.admin_address}")
            else:
                # Fallback: Use first pre-funded account on the local Hardhat Node
                if self.w3.is_connected():
                    self.admin_address = self.w3.eth.accounts[0]
                    print(f"No private key set. Defaulting to local Node primary account: {self.admin_address}")
                else:
                    print("Error: Web3 is not connected to any provider.")
            
            return True
        except Exception as e:
            print(f"Error loading contract: {str(e)}")
            return False

    def is_connected(self):
        return self.w3.is_connected()

    def get_network_info(self):
        if not self.is_connected():
            return {"connected": False, "message": "Disconnected"}
        
        return {
            "connected": True,
            "block_number": self.w3.eth.block_number,
            "chain_id": self.w3.eth.chain_id,
            "contract_address": self.contract_address if self.contract else None,
            "admin_address": self.admin_address
        }

    def compute_hash(self, student_name: str, degree_name: str, major: str, institution: str) -> str:
        """
        Computes a unique SHA-256 certificate hash deterministically.
        Converts the fields into a standard pipe-separated payload and hashes it.
        """
        payload = f"{student_name.strip()}|{degree_name.strip()}|{major.strip()}|{institution.strip()}"
        sha256_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        return "0x" + sha256_hash

    def issue_certificate(self, cert_hash_hex: str, name: str, degree: str, major: str, institution: str) -> dict:
        """
        Issues a certificate on the blockchain using the smart contract.
        Supports signing with private key (production) or node transaction (local testnet).
        """
        if not self.contract:
            if not self.load_contract():
                raise Exception("Smart contract not loaded. Ensure contract_info.json exists.")

        cert_hash_bytes = self.w3.to_bytes(hexstr=cert_hash_hex)

        try:
            # Check if already issued
            try:
                existing_cert = self.contract.functions.verifyCertificate(cert_hash_bytes).call()
                if existing_cert[5]:  # isValid
                    return {
                        "status": "already_exists",
                        "certificate_hash": cert_hash_hex,
                        "message": "Certificate already registered and is valid."
                    }
            except Exception:
                # If not found, verifyCertificate might throw revert string, which means it doesn't exist yet
                pass

            if self.private_key:
                # Production flow: sign transaction using private key
                nonce = self.w3.eth.get_transaction_count(self.admin_address)
                tx_build = self.contract.functions.issueCertificate(
                    cert_hash_bytes, name, degree, major, institution
                ).build_transaction({
                    "from": self.admin_address,
                    "nonce": nonce,
                    "gas": 300000,
                    "gasPrice": self.w3.eth.gas_price
                })
                
                signed_tx = self.w3.eth.account.sign_transaction(tx_build, private_key=self.private_key)
                tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            else:
                # Local flow: use unlocked node account directly (no local signing required)
                tx_hash = self.contract.functions.issueCertificate(
                    cert_hash_bytes, name, degree, major, institution
                ).transact({"from": self.admin_address})
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

            return {
                "status": "success",
                "transaction_hash": self.w3.to_hex(receipt.transactionHash),
                "certificate_hash": cert_hash_hex,
                "block_number": receipt.blockNumber,
                "gas_used": receipt.gasUsed
            }

        except Exception as e:
            raise Exception(f"Failed to issue certificate on-chain: {str(e)}")

    def revoke_certificate(self, cert_hash_hex: str) -> dict:
        """
        Revokes a certificate on the blockchain.
        """
        if not self.contract:
            if not self.load_contract():
                raise Exception("Smart contract not loaded.")

        cert_hash_bytes = self.w3.to_bytes(hexstr=cert_hash_hex)

        try:
            if self.private_key:
                nonce = self.w3.eth.get_transaction_count(self.admin_address)
                tx_build = self.contract.functions.revokeCertificate(cert_hash_bytes).build_transaction({
                    "from": self.admin_address,
                    "nonce": nonce,
                    "gas": 150000,
                    "gasPrice": self.w3.eth.gas_price
                })
                signed_tx = self.w3.eth.account.sign_transaction(tx_build, private_key=self.private_key)
                tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            else:
                tx_hash = self.contract.functions.revokeCertificate(cert_hash_bytes).transact({"from": self.admin_address})
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

            return {
                "status": "success",
                "transaction_hash": self.w3.to_hex(receipt.transactionHash),
                "certificate_hash": cert_hash_hex,
                "block_number": receipt.blockNumber
            }
        except Exception as e:
            raise Exception(f"Failed to revoke certificate: {str(e)}")

    def verify_certificate(self, cert_hash_hex: str) -> dict:
        """
        Queries the blockchain to verify a certificate hash and retrieve its metadata.
        """
        if not self.contract:
            if not self.load_contract():
                raise Exception("Smart contract not loaded.")

        cert_hash_bytes = self.w3.to_bytes(hexstr=cert_hash_hex)

        try:
            # Query the contract verifyCertificate view function
            student_name, degree_name, major, issue_date, institution, is_valid = (
                self.contract.functions.verifyCertificate(cert_hash_bytes).call()
            )
            
            return {
                "verified": is_valid,
                "student_name": student_name,
                "degree_name": degree_name,
                "major": major,
                "issue_date": issue_date,  # Unix timestamp
                "institution": institution,
                "status_code": "VERIFIED" if is_valid else "REVOKED"
            }
        except Exception as e:
            # If the call reverted, it typically means the certificate is not found
            if "not found" in str(e).lower() or "revert" in str(e).lower():
                return {
                    "verified": False,
                    "status_code": "NOT_FOUND",
                    "message": "Certificate hash not found on-chain."
                }
            raise Exception(f"Failed to query contract: {str(e)}")
