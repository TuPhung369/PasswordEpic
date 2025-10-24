package com.passwordepic.mobile.autofill

import android.util.Log

/**
 * PhishingDetector
 * 
 * Detects and prevents phishing attacks in autofill scenarios.
 * Implements multiple detection strategies for comprehensive protection.
 * 
 * Detection Methods:
 * - Homograph attack detection
 * - Typosquatting detection
 * - Suspicious domain patterns
 * - Known phishing domain database
 * - Real-time threat analysis
 */
class PhishingDetector {

    companion object {
        private const val TAG = "PhishingDetector"
        
        // Threat levels
        const val THREAT_NONE = 0
        const val THREAT_LOW = 1
        const val THREAT_MEDIUM = 2
        const val THREAT_HIGH = 3
        const val THREAT_CRITICAL = 4
    }

    /**
     * Known phishing domains (simplified list for demonstration)
     * In production, this should be a regularly updated database
     */
    private val knownPhishingDomains = setOf(
        "paypa1.com",
        "g00gle.com",
        "faceb00k.com",
        "micros0ft.com"
    )

    /**
     * Legitimate domains to protect against typosquatting
     */
    private val legitimateDomains = setOf(
        "google.com",
        "facebook.com",
        "twitter.com",
        "github.com",
        "microsoft.com",
        "apple.com",
        "amazon.com",
        "paypal.com",
        "netflix.com",
        "linkedin.com"
    )

    /**
     * Analyzes a domain for phishing threats
     * 
     * @param domain The domain to analyze
     * @return Threat analysis result
     */
    fun analyzeDomain(domain: String): ThreatAnalysis {
        Log.d(TAG, "Analyzing domain for threats: $domain")

        val threats = mutableListOf<Threat>()

        // Check known phishing domains
        if (isKnownPhishingDomain(domain)) {
            threats.add(
                Threat(
                    type = ThreatType.KNOWN_PHISHING,
                    level = THREAT_CRITICAL,
                    description = "Domain is in known phishing database"
                )
            )
        }

        // Check for homograph attacks
        val homographThreat = detectHomographAttack(domain)
        if (homographThreat != null) {
            threats.add(homographThreat)
        }

        // Check for typosquatting
        val typosquattingThreat = detectTyposquatting(domain)
        if (typosquattingThreat != null) {
            threats.add(typosquattingThreat)
        }

        // Check for suspicious patterns
        val patternThreats = detectSuspiciousPatterns(domain)
        threats.addAll(patternThreats)

        // Calculate overall threat level
        val overallThreatLevel = threats.maxOfOrNull { it.level } ?: THREAT_NONE

        val analysis = ThreatAnalysis(
            domain = domain,
            threatLevel = overallThreatLevel,
            threats = threats,
            isSafe = overallThreatLevel < THREAT_MEDIUM
        )

        Log.d(TAG, "Threat analysis complete: level=$overallThreatLevel, threats=${threats.size}")
        return analysis
    }

    /**
     * Checks if domain is in known phishing database
     * 
     * @param domain The domain to check
     * @return true if known phishing domain
     */
    private fun isKnownPhishingDomain(domain: String): Boolean {
        val normalized = domain.lowercase().trim()
        return knownPhishingDomains.contains(normalized)
    }

    /**
     * Detects homograph attacks (using similar-looking characters)
     * 
     * @param domain The domain to check
     * @return Threat if detected, null otherwise
     */
    private fun detectHomographAttack(domain: String): Threat? {
        // Check for mixed scripts
        val scripts = mutableSetOf<Character.UnicodeScript>()
        
        for (char in domain) {
            if (char.isLetter()) {
                val script = Character.UnicodeScript.of(char.code)
                if (script != Character.UnicodeScript.COMMON && 
                    script != Character.UnicodeScript.INHERITED) {
                    scripts.add(script)
                }
            }
        }

        if (scripts.size > 1) {
            return Threat(
                type = ThreatType.HOMOGRAPH_ATTACK,
                level = THREAT_HIGH,
                description = "Domain uses mixed character scripts (${scripts.joinToString()})"
            )
        }

        // Check for confusable characters
        val confusableChars = mapOf(
            'а' to 'a', // Cyrillic a
            'е' to 'e', // Cyrillic e
            'о' to 'o', // Cyrillic o
            'р' to 'p', // Cyrillic p
            'с' to 'c', // Cyrillic c
            'у' to 'y', // Cyrillic y
            'х' to 'x', // Cyrillic x
            'ӏ' to 'i', // Cyrillic i
            '0' to 'o', // Zero vs O
            '1' to 'l'  // One vs L
        )

        for ((confusable, legitimate) in confusableChars) {
            if (domain.contains(confusable)) {
                return Threat(
                    type = ThreatType.HOMOGRAPH_ATTACK,
                    level = THREAT_HIGH,
                    description = "Domain contains confusable character: '$confusable' (looks like '$legitimate')"
                )
            }
        }
        
        // Check for 'rn' vs 'm' confusion (string-based check)
        if (domain.contains("rn")) {
            return Threat(
                type = ThreatType.HOMOGRAPH_ATTACK,
                level = THREAT_HIGH,
                description = "Domain contains 'rn' which can look like 'm'"
            )
        }

        return null
    }

    /**
     * Detects typosquatting (domains similar to legitimate ones)
     * 
     * @param domain The domain to check
     * @return Threat if detected, null otherwise
     */
    private fun detectTyposquatting(domain: String): Threat? {
        val normalized = domain.lowercase().trim()

        for (legitimateDomain in legitimateDomains) {
            val similarity = calculateLevenshteinDistance(normalized, legitimateDomain)
            
            // If very similar but not exact match, it's likely typosquatting
            if (similarity in 1..2) {
                return Threat(
                    type = ThreatType.TYPOSQUATTING,
                    level = THREAT_HIGH,
                    description = "Domain is very similar to '$legitimateDomain' (distance: $similarity)"
                )
            }

            // Check for common typosquatting patterns
            if (isTyposquattingPattern(normalized, legitimateDomain)) {
                return Threat(
                    type = ThreatType.TYPOSQUATTING,
                    level = THREAT_MEDIUM,
                    description = "Domain uses typosquatting pattern of '$legitimateDomain'"
                )
            }
        }

        return null
    }

    /**
     * Detects suspicious domain patterns
     * 
     * @param domain The domain to check
     * @return List of detected threats
     */
    private fun detectSuspiciousPatterns(domain: String): List<Threat> {
        val threats = mutableListOf<Threat>()

        // Check for IP address
        if (domain.matches(Regex("^\\d+\\.\\d+\\.\\d+\\.\\d+$"))) {
            threats.add(
                Threat(
                    type = ThreatType.SUSPICIOUS_PATTERN,
                    level = THREAT_MEDIUM,
                    description = "Using IP address instead of domain name"
                )
            )
        }

        // Check for excessive subdomains
        val parts = domain.split(".")
        if (parts.size > 5) {
            threats.add(
                Threat(
                    type = ThreatType.SUSPICIOUS_PATTERN,
                    level = THREAT_LOW,
                    description = "Excessive number of subdomains (${parts.size})"
                )
            )
        }

        // Check for suspicious TLDs
        val suspiciousTlds = setOf("tk", "ml", "ga", "cf", "gq", "xyz", "top")
        val tld = parts.lastOrNull()?.lowercase()
        if (tld in suspiciousTlds) {
            threats.add(
                Threat(
                    type = ThreatType.SUSPICIOUS_PATTERN,
                    level = THREAT_LOW,
                    description = "Using suspicious TLD: .$tld"
                )
            )
        }

        // Check for excessive hyphens
        val hyphenCount = domain.count { it == '-' }
        if (hyphenCount > 3) {
            threats.add(
                Threat(
                    type = ThreatType.SUSPICIOUS_PATTERN,
                    level = THREAT_LOW,
                    description = "Excessive hyphens in domain ($hyphenCount)"
                )
            )
        }

        // Check for numbers in suspicious positions
        if (domain.matches(Regex(".*\\d{3,}.*"))) {
            threats.add(
                Threat(
                    type = ThreatType.SUSPICIOUS_PATTERN,
                    level = THREAT_LOW,
                    description = "Contains suspicious number sequence"
                )
            )
        }

        // Check for common phishing keywords
        val phishingKeywords = listOf("login", "secure", "account", "verify", "update", "confirm")
        for (keyword in phishingKeywords) {
            if (domain.contains(keyword)) {
                threats.add(
                    Threat(
                        type = ThreatType.SUSPICIOUS_PATTERN,
                        level = THREAT_LOW,
                        description = "Contains phishing keyword: '$keyword'"
                    )
                )
                break // Only report once
            }
        }

        return threats
    }

    /**
     * Checks for common typosquatting patterns
     * 
     * @param domain The domain to check
     * @param legitimate The legitimate domain
     * @return true if typosquatting pattern detected
     */
    private fun isTyposquattingPattern(domain: String, legitimate: String): Boolean {
        // Character substitution (e.g., 'o' -> '0')
        val substitutions = mapOf(
            'o' to '0',
            'i' to '1',
            'l' to '1',
            's' to '5',
            'a' to '4'
        )

        var modified = legitimate
        for ((from, to) in substitutions) {
            modified = modified.replace(from, to)
            if (domain == modified) return true
        }

        // Character insertion
        if (domain.length == legitimate.length + 1) {
            for (i in legitimate.indices) {
                val inserted = legitimate.substring(0, i) + domain[i] + legitimate.substring(i)
                if (domain == inserted) return true
            }
        }

        // Character deletion
        if (domain.length == legitimate.length - 1) {
            for (i in legitimate.indices) {
                val deleted = legitimate.substring(0, i) + legitimate.substring(i + 1)
                if (domain == deleted) return true
            }
        }

        // Character transposition
        for (i in 0 until legitimate.length - 1) {
            val transposed = legitimate.substring(0, i) +
                           legitimate[i + 1] +
                           legitimate[i] +
                           legitimate.substring(i + 2)
            if (domain == transposed) return true
        }

        return false
    }

    /**
     * Calculates Levenshtein distance between two strings
     * 
     * @param s1 First string
     * @param s2 Second string
     * @return Edit distance
     */
    private fun calculateLevenshteinDistance(s1: String, s2: String): Int {
        val len1 = s1.length
        val len2 = s2.length

        val dp = Array(len1 + 1) { IntArray(len2 + 1) }

        for (i in 0..len1) dp[i][0] = i
        for (j in 0..len2) dp[0][j] = j

        for (i in 1..len1) {
            for (j in 1..len2) {
                val cost = if (s1[i - 1] == s2[j - 1]) 0 else 1
                dp[i][j] = minOf(
                    dp[i - 1][j] + 1,      // deletion
                    dp[i][j - 1] + 1,      // insertion
                    dp[i - 1][j - 1] + cost // substitution
                )
            }
        }

        return dp[len1][len2]
    }

    /**
     * Checks if a domain should be blocked
     * 
     * @param analysis The threat analysis
     * @return true if domain should be blocked
     */
    fun shouldBlockDomain(analysis: ThreatAnalysis): Boolean {
        return analysis.threatLevel >= THREAT_HIGH
    }

    /**
     * Checks if user confirmation is required
     * 
     * @param analysis The threat analysis
     * @return true if confirmation required
     */
    fun requiresUserConfirmation(analysis: ThreatAnalysis): Boolean {
        return analysis.threatLevel >= THREAT_MEDIUM
    }
}

/**
 * Data class representing a threat analysis result
 */
data class ThreatAnalysis(
    val domain: String,
    val threatLevel: Int,
    val threats: List<Threat>,
    val isSafe: Boolean
)

/**
 * Data class representing a single threat
 */
data class Threat(
    val type: ThreatType,
    val level: Int,
    val description: String
)

/**
 * Enum representing threat types
 */
enum class ThreatType {
    KNOWN_PHISHING,
    HOMOGRAPH_ATTACK,
    TYPOSQUATTING,
    SUSPICIOUS_PATTERN,
    OTHER
}