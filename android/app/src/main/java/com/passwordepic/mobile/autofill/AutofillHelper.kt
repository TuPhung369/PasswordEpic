package com.passwordepic.mobile.autofill

import android.view.View
import android.view.autofill.AutofillId

/**
 * AutofillHelper
 * 
 * Utility class providing helper functions for Android Autofill operations.
 * Includes field detection, hint processing, and autofill value handling.
 */
object AutofillHelper {

    /**
     * Common autofill hints for username fields
     */
    val USERNAME_HINTS = setOf(
        View.AUTOFILL_HINT_USERNAME,
        View.AUTOFILL_HINT_EMAIL_ADDRESS,
        "username",
        "email",
        "user",
        "login",
        "account"
    )

    /**
     * Common autofill hints for password fields
     */
    val PASSWORD_HINTS = setOf(
        View.AUTOFILL_HINT_PASSWORD,
        "password",
        "pass",
        "pwd",
        "passwd"
    )

    /**
     * Common autofill hints for email fields
     */
    val EMAIL_HINTS = setOf(
        View.AUTOFILL_HINT_EMAIL_ADDRESS,
        "email",
        "e-mail",
        "mail"
    )

    /**
     * Common autofill hints for phone fields
     */
    val PHONE_HINTS = setOf(
        View.AUTOFILL_HINT_PHONE,
        "phone",
        "mobile",
        "tel",
        "telephone"
    )

    /**
     * Keywords that indicate a username field in field IDs or hints
     */
    val USERNAME_KEYWORDS = listOf(
        "user", "username", "login", "email", "account", "id"
    )

    /**
     * Keywords that indicate a password field in field IDs or hints
     */
    val PASSWORD_KEYWORDS = listOf(
        "pass", "password", "pwd", "passwd", "secret"
    )

    /**
     * Determines the field type based on autofill hints
     * 
     * @param hints Array of autofill hints
     * @return FieldType enum value
     */
    fun getFieldTypeFromHints(hints: Array<String>?): FieldType {
        if (hints.isNullOrEmpty()) {
            return FieldType.OTHER
        }

        val hintsLower = hints.map { it.lowercase() }

        return when {
            hintsLower.any { it in PASSWORD_HINTS } -> FieldType.PASSWORD
            hintsLower.any { it in EMAIL_HINTS } -> FieldType.EMAIL
            hintsLower.any { it in USERNAME_HINTS } -> FieldType.USERNAME
            hintsLower.any { it in PHONE_HINTS } -> FieldType.PHONE
            else -> FieldType.OTHER
        }
    }

    /**
     * Determines the field type based on field ID or resource name
     * 
     * @param idEntry The resource ID entry name
     * @return FieldType enum value
     */
    fun getFieldTypeFromId(idEntry: String?): FieldType {
        if (idEntry.isNullOrEmpty()) {
            return FieldType.OTHER
        }

        val idLower = idEntry.lowercase()

        return when {
            PASSWORD_KEYWORDS.any { idLower.contains(it) } -> FieldType.PASSWORD
            USERNAME_KEYWORDS.any { idLower.contains(it) } -> FieldType.USERNAME
            idLower.contains("email") || idLower.contains("mail") -> FieldType.EMAIL
            idLower.contains("phone") || idLower.contains("tel") -> FieldType.PHONE
            else -> FieldType.OTHER
        }
    }

    /**
     * Determines the field type based on HTML input type
     * 
     * @param inputType The HTML input type attribute
     * @return FieldType enum value
     */
    fun getFieldTypeFromInputType(inputType: String?): FieldType {
        if (inputType.isNullOrEmpty()) {
            return FieldType.OTHER
        }

        return when (inputType.lowercase()) {
            "password" -> FieldType.PASSWORD
            "email" -> FieldType.EMAIL
            "tel", "phone" -> FieldType.PHONE
            "text", "username" -> FieldType.USERNAME
            else -> FieldType.OTHER
        }
    }

    /**
     * Checks if a field is likely a password field based on input type
     * 
     * @param inputType Android input type flags
     * @return true if likely a password field
     */
    fun isPasswordInputType(inputType: Int): Boolean {
        val TYPE_TEXT_VARIATION_PASSWORD = 0x00000080
        val TYPE_TEXT_VARIATION_WEB_PASSWORD = 0x000000e0
        val TYPE_TEXT_VARIATION_VISIBLE_PASSWORD = 0x00000090
        val TYPE_NUMBER_VARIATION_PASSWORD = 0x00000010

        return (inputType and TYPE_TEXT_VARIATION_PASSWORD) != 0 ||
               (inputType and TYPE_TEXT_VARIATION_WEB_PASSWORD) != 0 ||
               (inputType and TYPE_TEXT_VARIATION_VISIBLE_PASSWORD) != 0 ||
               (inputType and TYPE_NUMBER_VARIATION_PASSWORD) != 0
    }

    /**
     * Extracts domain from a URL
     * 
     * @param url The full URL
     * @return Domain name or null if invalid
     */
    fun extractDomain(url: String?): String? {
        if (url.isNullOrEmpty()) return null

        return try {
            val urlLower = url.lowercase()
            
            // Remove protocol
            var domain = urlLower
                .removePrefix("https://")
                .removePrefix("http://")
                .removePrefix("www.")
            
            // Remove path and query
            domain = domain.split("/").firstOrNull() ?: domain
            domain = domain.split("?").firstOrNull() ?: domain
            domain = domain.split("#").firstOrNull() ?: domain
            
            // Remove port
            domain = domain.split(":").firstOrNull() ?: domain
            
            if (domain.isNotEmpty() && domain.contains(".")) {
                domain
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Normalizes a domain name for comparison
     * 
     * @param domain The domain to normalize
     * @return Normalized domain
     */
    fun normalizeDomain(domain: String): String {
        return domain.lowercase()
            .removePrefix("www.")
            .trim()
    }

    /**
     * Checks if two domains match (including subdomain matching)
     * 
     * @param domain1 First domain
     * @param domain2 Second domain
     * @param allowSubdomains Whether to allow subdomain matching
     * @return true if domains match
     */
    fun domainsMatch(
        domain1: String,
        domain2: String,
        allowSubdomains: Boolean = true
    ): Boolean {
        val normalized1 = normalizeDomain(domain1)
        val normalized2 = normalizeDomain(domain2)

        if (normalized1 == normalized2) {
            return true
        }

        if (!allowSubdomains) {
            return false
        }

        // Check if one is a subdomain of the other
        return normalized1.endsWith(".$normalized2") || 
               normalized2.endsWith(".$normalized1")
    }

    /**
     * Validates if a string is a valid domain name
     * 
     * @param domain The domain to validate
     * @return true if valid domain
     */
    fun isValidDomain(domain: String?): Boolean {
        if (domain.isNullOrEmpty()) return false

        val domainRegex = Regex(
            "^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$",
            RegexOption.IGNORE_CASE
        )

        return domainRegex.matches(domain)
    }

    /**
     * Extracts package name from Android package identifier
     * 
     * @param packageName The full package name
     * @return Simplified package name for display
     */
    fun simplifyPackageName(packageName: String): String {
        return packageName.split(".").lastOrNull() ?: packageName
    }

    /**
     * Checks if a package name is from a known browser
     * 
     * @param packageName The package name to check
     * @return true if it's a browser package
     */
    fun isBrowserPackage(packageName: String): Boolean {
        val browserPackages = setOf(
            "com.android.chrome",
            "org.mozilla.firefox",
            "com.opera.browser",
            "com.microsoft.emmx",
            "com.brave.browser",
            "com.duckduckgo.mobile.android",
            "org.chromium.chrome",
            "com.sec.android.app.sbrowser" // Samsung Internet
        )

        return browserPackages.contains(packageName)
    }

    /**
     * Generates a unique key for a field based on its properties
     * 
     * @param autofillId The autofill ID
     * @param hint The autofill hint
     * @param idEntry The resource ID entry
     * @return Unique key string
     */
    fun generateFieldKey(
        autofillId: AutofillId,
        hint: String?,
        idEntry: String?
    ): String {
        return "${autofillId.hashCode()}_${hint}_${idEntry}"
    }

    /**
     * Sanitizes a string for safe logging (removes sensitive data)
     * 
     * @param value The value to sanitize
     * @param maxLength Maximum length to show
     * @return Sanitized string
     */
    fun sanitizeForLog(value: String?, maxLength: Int = 20): String {
        if (value.isNullOrEmpty()) return "[empty]"
        
        return if (value.length > maxLength) {
            "${value.take(maxLength)}... [${value.length} chars]"
        } else {
            value
        }
    }

    /**
     * Checks if a field should be autofilled based on its properties
     * 
     * @param fieldType The type of field
     * @param isVisible Whether the field is visible
     * @param isEnabled Whether the field is enabled
     * @return true if field should be autofilled
     */
    fun shouldAutofillField(
        fieldType: FieldType,
        isVisible: Boolean,
        isEnabled: Boolean
    ): Boolean {
        // Only autofill username, password, and email fields
        if (fieldType !in listOf(FieldType.USERNAME, FieldType.PASSWORD, FieldType.EMAIL)) {
            return false
        }

        // Field must be visible and enabled
        return isVisible && isEnabled
    }

    /**
     * Estimates password strength based on length and character variety
     * 
     * @param password The password to analyze
     * @return Strength score (0-4)
     */
    fun estimatePasswordStrength(password: String): Int {
        if (password.isEmpty()) return 0

        var score = 0

        // Length check
        when {
            password.length >= 16 -> score += 2
            password.length >= 12 -> score += 1
        }

        // Character variety
        if (password.any { it.isUpperCase() }) score++
        if (password.any { it.isLowerCase() }) score++
        if (password.any { it.isDigit() }) score++
        if (password.any { !it.isLetterOrDigit() }) score++

        return minOf(score, 4)
    }
}