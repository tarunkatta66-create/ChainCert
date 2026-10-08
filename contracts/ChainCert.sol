// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ChainCert
 * @dev Academic Credential Verification System on Ethereum.
 * Allows university administrators to issue and verify immutable academic certificates.
 */
contract ChainCert {
    // --- Access Control ---
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "ChainCert: Caller is not the owner (University Admin)");
        _;
    }

    // --- State Variables ---
    struct Certificate {
        string studentName;
        string degreeName;
        string major;
        uint256 issueDate;
        string institution;
        bool isValid;
    }

    // Mapping from SHA-256 certificate hash to Certificate metadata
    mapping(bytes32 => Certificate) public certificates;

    // --- Events ---
    event CertificateIssued(
        bytes32 indexed certHash,
        string studentName,
        string degreeName,
        string institution,
        uint256 issueDate
    );
    
    event CertificateRevoked(bytes32 indexed certHash);

    // --- Constructor ---
    constructor() {
        owner = msg.sender;
    }

    // --- Owner Management ---
    /**
     * @dev Transfers ownership of the contract to a new admin.
     * @param _newOwner Address of the new university administrator.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "ChainCert: New owner is the zero address");
        owner = _newOwner;
    }

    // --- Core Functions ---

    /**
     * @dev Issues a new certificate on-chain. Restricted to University Admin (owner).
     * @param _certHash Unique SHA-256 cryptographic hash representing the certificate metadata.
     * @param _name Full name of the student.
     * @param _degree Name of the degree (e.g., Bachelor of Science).
     * @param _major Field of study / major (e.g., Computer Science).
     * @param _institution Issuing university/institution.
     */
    function issueCertificate(
        bytes32 _certHash,
        string calldata _name,
        string calldata _degree,
        string calldata _major,
        string calldata _institution
    ) external onlyOwner {
        require(_certHash != bytes32(0), "ChainCert: Certificate hash cannot be empty");
        require(!certificates[_certHash].isValid, "ChainCert: Certificate hash already exists and is valid");

        certificates[_certHash] = Certificate({
            studentName: _name,
            degreeName: _degree,
            major: _major,
            issueDate: block.timestamp,
            institution: _institution,
            isValid: true
        });

        emit CertificateIssued(_certHash, _name, _degree, _institution, block.timestamp);
    }

    /**
     * @dev Revokes an existing certificate on-chain. Restricted to University Admin (owner).
     * @param _certHash Unique SHA-256 cryptographic hash of the certificate to revoke.
     */
    function revokeCertificate(bytes32 _certHash) external onlyOwner {
        require(_certHash != bytes32(0), "ChainCert: Certificate hash cannot be empty");
        require(certificates[_certHash].isValid, "ChainCert: Certificate does not exist or is already invalid/revoked");

        certificates[_certHash].isValid = false;

        emit CertificateRevoked(_certHash);
    }

    /**
     * @dev Verifies a certificate by hash and returns its full metadata details.
     * @param _certHash Unique SHA-256 cryptographic hash of the certificate.
     */
    function verifyCertificate(bytes32 _certHash)
        external
        view
        returns (
            string memory studentName,
            string memory degreeName,
            string memory major,
            uint256 issueDate,
            string memory institution,
            bool isValid
        )
    {
        Certificate memory cert = certificates[_certHash];
        require(cert.issueDate > 0, "ChainCert: Certificate hash not found");
        return (
            cert.studentName,
            cert.degreeName,
            cert.major,
            cert.issueDate,
            cert.institution,
            cert.isValid
        );
    }
}
