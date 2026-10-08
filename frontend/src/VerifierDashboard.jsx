import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { 
  ShieldCheck, 
  Search, 
  User, 
  GraduationCap, 
  Building2, 
  Calendar, 
  Hash, 
  Wallet, 
  AlertTriangle, 
  PlusCircle, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Copy,
  ExternalLink,
  Lock,
  Database
} from 'lucide-react';

// Attempt to load contract information exported by deployment script
let contractABI = [];
let contractAddress = "";
try {
  // Import dynamically or fallback. Since we are compiling in Vite, we can try importing.
  // We'll write this file as a dependency. If it doesn't exist, we declare placeholders
  // so the component doesn't crash before the first contract deployment.
  const contractInfo = import.meta.glob('./contract_info.json', { eager: true });
  const info = Object.values(contractInfo)[0];
  if (info) {
    contractAddress = info.address;
    contractABI = info.abi;
  }
} catch (e) {
  console.log("Contract info not loaded yet. It will be imported once deploy.js runs.");
}

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function VerifierDashboard() {
  // Navigation
  const [activeTab, setActiveTab] = useState('verifier'); // 'verifier' or 'issuer'

  // Web3 States
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [isContractOwner, setIsContractOwner] = useState(false);
  const [networkName, setNetworkName] = useState('');
  const [contractDetails, setContractDetails] = useState({ address: contractAddress, ready: !!contractAddress });

  // Issuer Form States
  const [studentName, setStudentName] = useState('');
  const [degreeName, setDegreeName] = useState('');
  const [major, setMajor] = useState('');
  const [institution, setInstitution] = useState('');
  const [computedHash, setComputedHash] = useState('');
  const [issueMethod, setIssueMethod] = useState('relay'); // 'metamask' or 'relay'
  const [isHashing, setIsHashing] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issuanceResult, setIssuanceResult] = useState(null);

  // Verifier States
  const [searchHash, setSearchHash] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null); // { verified: bool, data: ... }
  
  // Alert/Message banner
  const [banner, setBanner] = useState(null); // { type: 'success'|'error', text: '' }

  // Load contract details if they change
  useEffect(() => {
    // If contract info is written to disk, update state
    if (contractAddress) {
      setContractDetails({ address: contractAddress, ready: true });
    }
  }, []);

  // Show status banners helper
  const triggerBanner = (type, text) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 6000);
  };

  // Connect MetaMask Wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      triggerBanner('error', 'MetaMask is not installed. Please install it to interact with the blockchain directly.');
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      setUserAddress(address);
      setWalletConnected(true);
      setNetworkName(network.name === 'unknown' ? `Chain ID ${network.chainId}` : network.name);
      
      // If contract is deployed, check if user is owner
      if (contractDetails.ready) {
        const contract = new ethers.Contract(contractDetails.address, contractABI, provider);
        const owner = await contract.owner();
        setIsContractOwner(owner.toLowerCase() === address.toLowerCase());
      }
      
      triggerBanner('success', 'Wallet connected successfully!');
    } catch (err) {
      console.error(err);
      triggerBanner('error', 'Failed to connect wallet: ' + err.message);
    }
  };

  // Listen to Account/Network changes in MetaMask
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setUserAddress(accounts[0]);
          setWalletConnected(true);
          // Recheck owner
          if (contractDetails.ready) {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const contract = new ethers.Contract(contractDetails.address, contractABI, provider);
            contract.owner().then(owner => {
              setIsContractOwner(owner.toLowerCase() === accounts[0].toLowerCase());
            });
          }
        } else {
          setWalletConnected(false);
          setUserAddress('');
          setIsContractOwner(false);
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  }, [contractDetails]);

  // Compute Deterministic SHA-256 Hash via backend
  const handleComputeHash = async (e) => {
    e.preventDefault();
    if (!studentName || !degreeName || !major || !institution) {
      triggerBanner('error', 'All certificate fields are required to calculate the deterministic hash.');
      return;
    }

    setIsHashing(true);
    setComputedHash('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/certificates/hash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name: studentName,
          degree_name: degreeName,
          major: major,
          institution: institution
        })
      });
      
      if (!response.ok) throw new Error('Backend failed to compute hash.');
      const data = await response.json();
      setComputedHash(data.hash);
      triggerBanner('success', 'Deterministic hash calculated successfully!');
    } catch (err) {
      console.error(err);
      triggerBanner('error', 'Error generating hash: ' + err.message);
    } finally {
      setIsHashing(false);
    }
  };

  // Issue Certificate on Blockchain
  const handleIssueCertificate = async () => {
    if (!computedHash) {
      triggerBanner('error', 'Please compute the certificate hash first.');
      return;
    }

    setIsIssuing(true);
    setIssuanceResult(null);

    try {
      if (issueMethod === 'metamask') {
        // Direct MetaMask on-chain write
        if (!walletConnected) {
          throw new Error('Please connect your wallet first.');
        }
        if (!contractDetails.ready) {
          throw new Error('Contract address not found. Ensure the smart contract is compiled and deployed.');
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(contractDetails.address, contractABI, signer);

        triggerBanner('success', 'Awaiting wallet signature for contract write...');
        const tx = await contract.issueCertificate(
          computedHash,
          studentName,
          degreeName,
          major,
          institution
        );
        
        triggerBanner('success', 'Transaction broadcasted! Awaiting block confirmation...');
        const receipt = await tx.wait();

        setIssuanceResult({
          status: 'success',
          transaction_hash: receipt.hash,
          certificate_hash: computedHash,
          block_number: receipt.blockNumber,
          method: 'Direct (MetaMask)'
        });
        triggerBanner('success', 'Degree successfully anchored to Ethereum blockchain!');
      } else {
        // API Gateway Relay write
        triggerBanner('success', 'Relaying transaction to backend admin gateway...');
        const response = await fetch(`${BACKEND_URL}/api/v1/certificates/issue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_name: studentName,
            degree_name: degreeName,
            major: major,
            institution: institution
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Relay transaction failed.');
        }

        const data = await response.json();
        setIssuanceResult({
          status: data.status,
          transaction_hash: data.transaction_hash,
          certificate_hash: data.certificate_hash,
          block_number: data.block_number,
          method: 'API Relay Gateway'
        });

        if (data.status === 'already_exists') {
          triggerBanner('warning', 'This certificate is already active on-chain!');
        } else {
          triggerBanner('success', 'Degree anchored successfully via Admin Gateway!');
        }
      }

      // Reset form on success
      setStudentName('');
      setDegreeName('');
      setMajor('');
      setInstitution('');
    } catch (err) {
      console.error(err);
      triggerBanner('error', 'Issuance failed: ' + err.message);
    } finally {
      setIsIssuing(false);
    }
  };

  // Verify Certificate (Checks on-chain directly or via backend API)
  const handleVerify = async (e) => {
    e.preventDefault();
    if (!searchHash.trim()) {
      triggerBanner('error', 'Please enter a valid certificate SHA-256 hash.');
      return;
    }

    const cleanHash = searchHash.trim();
    if (!cleanHash.startsWith('0x') || cleanHash.length !== 66) {
      triggerBanner('error', 'Invalid hash. Must be a 32-byte hex starting with 0x (66 characters).');
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    // If MetaMask is connected and contract is ready, verify client-side directly on-chain
    if (walletConnected && contractDetails.ready) {
      try {
        console.log("Verifying on-chain via client-side provider...");
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(contractDetails.address, contractABI, provider);
        
        const data = await contract.verifyCertificate(cleanHash);
        
        // struct returns: [studentName, degreeName, major, issueDate, institution, isValid]
        setVerificationResult({
          verified: data[5], // isValid
          student_name: data[0],
          degree_name: data[1],
          major: data[2],
          issue_date: Number(data[3]),
          institution: data[4],
          source: 'Direct On-Chain (Ethers)'
        });
        
        triggerBanner('success', 'Fetched record directly from smart contract!');
      } catch (err) {
        console.log("Ethers direct fetch failed, falling back to API. Reason:", err.message);
        await fallbackToApiVerify(cleanHash);
      } finally {
        setIsVerifying(false);
      }
    } else {
      // Fallback: Verify via FastAPI Backend
      await fallbackToApiVerify(cleanHash);
      setIsVerifying(false);
    }
  };

  const fallbackToApiVerify = async (hash) => {
    try {
      console.log("Verifying via backend API...");
      const response = await fetch(`${BACKEND_URL}/api/v1/certificates/verify/${hash}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'API verification failed.');
      }
      
      const data = await response.json();
      if (data.status_code === 'NOT_FOUND') {
        setVerificationResult({
          verified: false,
          not_found: true,
          source: 'API Gateway Cache'
        });
      } else {
        setVerificationResult({
          verified: data.verified,
          student_name: data.student_name,
          degree_name: data.degree_name,
          major: data.major,
          issue_date: data.issue_date,
          institution: data.institution,
          source: 'API Gateway Relay'
        });
      }
    } catch (err) {
      console.error(err);
      triggerBanner('error', 'Verification query failed: ' + err.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    triggerBanner('success', 'Copied to clipboard!');
  };

  return (
    <div className="relative min-h-screen bg-[#0B0F19] text-gray-100 overflow-hidden bg-grid-pattern">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full gradient-glow-1 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full gradient-glow-2 pointer-events-none" />
      <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] rounded-full gradient-glow-3 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-black/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                ChainCert
              </h1>
              <p className="text-[10px] text-gray-500 font-mono">Academic Credential Ledger</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Wallet Button */}
            {walletConnected ? (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 py-1.5 px-3 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-mono text-gray-300">
                  {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
                </span>
                {isContractOwner && (
                  <span className="text-[9px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded uppercase font-semibold">
                    Admin
                  </span>
                )}
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all duration-300 transform active:scale-95"
              >
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Floating Status Banners */}
      {banner && (
        <div className="fixed bottom-8 right-8 z-50 animate-bounce">
          <div className={`glass-panel py-3 px-5 rounded-2xl flex items-center gap-3 shadow-2xl ${
            banner.type === 'error' ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200'
          }`}>
            {banner.type === 'error' ? <XCircle className="w-5 h-5 text-red-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            <span className="text-sm font-medium">{banner.text}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-10 relative z-10">
        
        {/* Network & Contract Diagnostics */}
        <section className="mb-10 p-5 rounded-3xl glass-panel flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Database className="w-10 h-10 text-blue-400" />
            <div>
              <h2 className="text-sm font-semibold text-gray-300">Contract Integrity Diagnostics</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono text-gray-500">Registry Address:</span>
                {contractDetails.ready ? (
                  <button 
                    onClick={() => copyToClipboard(contractDetails.address)}
                    className="text-xs font-mono text-blue-400 hover:underline flex items-center gap-1"
                  >
                    {contractDetails.address}
                    <Copy className="w-3 h-3" />
                  </button>
                ) : (
                  <span className="text-xs text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Not deployed/unconfigured. Please run Hardhat deploy script.
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-gray-400">
              Provider: <strong className="text-gray-300 font-mono">localhost:8545</strong>
            </span>
            {walletConnected && (
              <span className="text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-gray-400">
                Network: <strong className="text-blue-400 font-mono">{networkName}</strong>
              </span>
            )}
          </div>
        </section>

        {/* Tab Selection Navigation */}
        <div className="flex justify-center mb-10">
          <div className="bg-black/40 border border-white/5 p-1 rounded-2xl flex gap-1">
            <button
              onClick={() => setActiveTab('verifier')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTab === 'verifier'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/10'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              <Search className="w-4 h-4" />
              Public Verification Portal
            </button>
            <button
              onClick={() => setActiveTab('issuer')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTab === 'issuer'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/10'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              University Admin Registry
            </button>
          </div>
        </div>

        {/* --- Tab 1: Verifier View --- */}
        {activeTab === 'verifier' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-extrabold tracking-tight">Credential Cryptographic Verifier</h2>
              <p className="text-gray-400 max-w-lg mx-auto text-sm leading-relaxed">
                Paste a certificate's SHA-256 cryptographic hash representation to verify its integrity directly on the decentralized ledger.
              </p>
            </div>

            {/* Input Search Form */}
            <form onSubmit={handleVerify} className="flex gap-3">
              <div className="relative flex-grow">
                <Hash className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Enter Certificate SHA-256 Hash (e.g. 0x...)"
                  value={searchHash}
                  onChange={(e) => setSearchHash(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl glass-input text-sm font-mono placeholder:text-gray-600"
                />
              </div>
              <button
                type="submit"
                disabled={isVerifying}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-8 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-600/20"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Querying Ledger...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Verify Hash
                  </>
                )}
              </button>
            </form>

            {/* Search results display */}
            {verificationResult && (
              <div className="mt-8 animate-fadeIn">
                {verificationResult.verified ? (
                  // VERIFIED CARD
                  <div className="rounded-3xl border border-emerald-500/20 bg-emerald-950/20 backdrop-blur-md shadow-glass-emerald p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-emerald-500/10 text-emerald-400 border-l border-b border-emerald-500/20 px-4 py-1.5 text-xs font-mono rounded-bl-xl uppercase tracking-wider font-semibold">
                      {verificationResult.source}
                    </div>
                    
                    <div className="flex items-center gap-4 mb-6">
                      <div className="bg-emerald-500/20 p-3 rounded-2xl border border-emerald-500/30">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      </div>
                      <div>
                        <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold font-mono">Status Status</span>
                        <h3 className="text-2xl font-black text-white flex items-center gap-2">
                          VERIFIED CERTIFICATE ✔
                        </h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-6">
                      <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Graduate Name</p>
                          <p className="text-lg font-semibold text-gray-200">{verificationResult.student_name}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <GraduationCap className="w-5 h-5 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Degree Program</p>
                          <p className="text-lg font-semibold text-gray-200">
                            {verificationResult.degree_name} in {verificationResult.major}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Building2 className="w-5 h-5 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Issuing Institution</p>
                          <p className="text-lg font-semibold text-gray-200">{verificationResult.institution}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Anchored Date</p>
                          <p className="text-lg font-semibold text-gray-200">
                            {new Date(verificationResult.issue_date * 1000).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/5 flex flex-col gap-2">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono font-bold">Registry SHA-256 Fingerprint</span>
                      <span className="text-xs font-mono text-gray-300 break-all bg-black/40 border border-white/5 px-3 py-2 rounded-xl">
                        {searchHash}
                      </span>
                    </div>
                  </div>
                ) : (
                  // INVALID / TAMPERED / NOT FOUND CARD
                  <div className="rounded-3xl border border-red-500/20 bg-red-950/20 backdrop-blur-md shadow-glass-red p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-red-500/10 text-red-400 border-l border-b border-red-500/20 px-4 py-1.5 text-xs font-mono rounded-bl-xl uppercase tracking-wider font-semibold">
                      {verificationResult.source}
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                      <div className="bg-red-500/20 p-3 rounded-2xl border border-red-500/30">
                        <XCircle className="w-8 h-8 text-red-400" />
                      </div>
                      <div>
                        <span className="text-xs uppercase tracking-widest text-red-400 font-bold font-mono">Integrity Alert</span>
                        <h3 className="text-2xl font-black text-white">
                          TAMPERED / INVALID RECORD ❌
                        </h3>
                      </div>
                    </div>

                    <p className="text-sm text-red-200/80 mb-4 leading-relaxed">
                      {verificationResult.not_found 
                        ? 'No record matching this cryptographic fingerprint was found in the smart contract registry. The degree hash could be incorrect or has not been issued.'
                        : 'The certificate mapping lookup succeeded but is flagged as REVOKED or DEACTIVATED by the university administrator.'
                      }
                    </p>

                    <div className="bg-black/30 border border-white/5 px-3 py-2 rounded-xl">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono font-bold block mb-1">Queried Fingerprint</span>
                      <span className="text-xs font-mono text-red-400 break-all">{searchHash}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- Tab 2: Issuer (University Admin) View --- */}
        {activeTab === 'issuer' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fadeIn">
            
            {/* Form Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold">Academic Degree Registry</h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Enter official academic metadata to calculate a secure SHA-256 fingerprint, then commit the record permanently to the Ethereum ledger.
                </p>
              </div>

              <form onSubmit={handleComputeHash} className="p-6 rounded-3xl glass-panel space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400">Graduate Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Alice Johnson"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm placeholder:text-gray-600"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400">Issuing Institution</label>
                    <input
                      type="text"
                      placeholder="e.g. State University"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm placeholder:text-gray-600"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400">Degree Classification</label>
                    <input
                      type="text"
                      placeholder="e.g. Bachelor of Science"
                      value={degreeName}
                      onChange={(e) => setDegreeName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm placeholder:text-gray-600"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400">Major / Field of Study</label>
                    <input
                      type="text"
                      placeholder="e.g. Computer Science"
                      value={major}
                      onChange={(e) => setMajor(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm placeholder:text-gray-600"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isHashing}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 active:scale-98"
                  >
                    {isHashing ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <Hash className="w-4 h-4 text-blue-400" />}
                    Calculate Cryptographic Hash
                  </button>
                </div>
              </form>

              {/* Action and Hash block */}
              {computedHash && (
                <div className="p-6 rounded-3xl glass-panel border-blue-500/20 bg-blue-950/5 space-y-6 animate-fadeIn">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-300">Generated Certificate Fingerprint</h3>
                    <div className="flex gap-2">
                      <div className="flex-grow font-mono text-xs text-blue-300 bg-black/40 border border-white/5 p-3 rounded-xl break-all">
                        {computedHash}
                      </div>
                      <button
                        onClick={() => copyToClipboard(computedHash)}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 p-3 rounded-xl text-gray-400 hover:text-white transition-all"
                        title="Copy Fingerprint"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Issuing options */}
                  <div className="space-y-4">
                    <label className="text-xs font-semibold text-gray-400 block">Select Anchor Method</label>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Metamask Method */}
                      <button
                        type="button"
                        onClick={() => setIssueMethod('metamask')}
                        className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-24 transition-all duration-200 ${
                          issueMethod === 'metamask' 
                            ? 'border-blue-500 bg-blue-950/20 text-white shadow-glass-blue' 
                            : 'border-white/5 bg-black/20 text-gray-400 hover:border-white/10'
                        }`}
                      >
                        <Wallet className="w-5 h-5 text-blue-400" />
                        <div>
                          <p className="text-xs font-bold">Client-Side (MetaMask)</p>
                          <p className="text-[10px] text-gray-500 font-medium">Transact via Web3 wallet</p>
                        </div>
                      </button>

                      {/* API Relay Method */}
                      <button
                        type="button"
                        onClick={() => setIssueMethod('relay')}
                        className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-24 transition-all duration-200 ${
                          issueMethod === 'relay' 
                            ? 'border-blue-500 bg-blue-950/20 text-white shadow-glass-blue' 
                            : 'border-white/5 bg-black/20 text-gray-400 hover:border-white/10'
                        }`}
                      >
                        <Database className="w-5 h-5 text-emerald-400" />
                        <div>
                          <p className="text-xs font-bold">Relayed API Gateway</p>
                          <p className="text-[10px] text-gray-500 font-medium">Backend admin signatures</p>
                        </div>
                      </button>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={handleIssueCertificate}
                        disabled={isIssuing || (issueMethod === 'metamask' && !walletConnected)}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-blue-800 disabled:to-indigo-900 text-white py-3.5 rounded-2xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                      >
                        {isIssuing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Anchoring to Ledger...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            {issueMethod === 'metamask' && !walletConnected 
                              ? 'Connect Wallet to Issue' 
                              : 'Commit to Blockchain'
                            }
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Diagnostics Column */}
            <div className="lg:col-span-5 space-y-6">
              <div className="p-6 rounded-3xl glass-panel space-y-5">
                <h3 className="text-lg font-bold flex items-center gap-2 border-b border-white/5 pb-3">
                  <Lock className="w-5 h-5 text-indigo-400" />
                  Role-Based Access
                </h3>

                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Smart Contract Owner:</span>
                    <span className="font-mono text-gray-300">
                      {contractDetails.ready ? `${contractAddress.slice(0, 8)}...` : 'N/A'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Your Connected Address:</span>
                    <span className="font-mono text-gray-300">
                      {walletConnected ? `${userAddress.slice(0, 8)}...` : 'Not Connected'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-white/5 pt-3">
                    <span className="text-gray-400">Permission Check:</span>
                    {walletConnected ? (
                      isContractOwner ? (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                          OWNER APPROVED
                        </span>
                      ) : (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                          NON-ADMIN CLIENT
                        </span>
                      )
                    ) : (
                      <span className="text-[10px] bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                        UNKNOWN
                      </span>
                    )}
                  </div>
                </div>

                {walletConnected && !isContractOwner && (
                  <div className="p-3 bg-red-950/20 border border-red-500/20 text-red-300 rounded-xl text-xs flex gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <span>
                      Your wallet is not contract owner. Direct MetaMask commits will revert. Use <strong>API Relay Gateway</strong> to authorize transactions via backend university keys.
                    </span>
                  </div>
                )}
              </div>

              {/* Issuance success receipt */}
              {issuanceResult && (
                <div className="p-6 rounded-3xl border border-emerald-500/20 bg-emerald-950/10 space-y-4 animate-fadeIn">
                  <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest font-mono">
                    Transaction Receipt
                  </h3>
                  
                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Method:</span>
                      <span className="font-semibold text-gray-300">{issuanceResult.method}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-500">Block:</span>
                      <span className="font-mono font-semibold text-gray-300">
                        #{issuanceResult.block_number || 'Pending'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-gray-500 block">Transaction Hash:</span>
                      <div className="flex gap-2">
                        <span className="font-mono text-gray-300 break-all bg-black/30 p-2 rounded-lg flex-grow">
                          {issuanceResult.transaction_hash || 'N/A'}
                        </span>
                        {issuanceResult.transaction_hash && (
                          <button
                            onClick={() => copyToClipboard(issuanceResult.transaction_hash)}
                            className="bg-white/5 hover:bg-white/10 p-2 rounded-lg text-gray-400 hover:text-white"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
