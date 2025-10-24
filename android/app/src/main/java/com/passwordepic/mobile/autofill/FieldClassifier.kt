package com.passwordepic.mobile.autofill

import android.util.Log

/**
 * FieldClassifier
 * 
 * Advanced field classification using heuristics and pattern matching.
 * Provides intelligent field type detection for various languages and formats.
 * 
 * Features:
 * - Multi-language field label recognition
 * - Pattern-based classification
 * - Confidence scoring
 * - Custom field pattern support
 */
class FieldClassifier {

    companion object {
        private const val TAG = "FieldClassifier"
        
        // Confidence thresholds
        private const val HIGH_CONFIDENCE = 0.8
        private const val MEDIUM_CONFIDENCE = 0.5
        private const val LOW_CONFIDENCE = 0.3
    }

    /**
     * Multi-language patterns for username fields
     */
    private val usernamePatterns = mapOf(
        "en" to listOf(
            "username", "user name", "user", "login", "account", "email", "e-mail"
        ),
        "vi" to listOf(
            "tên đăng nhập", "tài khoản", "người dùng", "email"
        ),
        "es" to listOf(
            "usuario", "nombre de usuario", "cuenta", "correo"
        ),
        "fr" to listOf(
            "nom d'utilisateur", "utilisateur", "compte", "courriel"
        ),
        "de" to listOf(
            "benutzername", "benutzer", "konto", "e-mail"
        ),
        "zh" to listOf(
            "用户名", "用户", "账号", "邮箱"
        ),
        "ja" to listOf(
            "ユーザー名", "ユーザー", "アカウント", "メール"
        ),
        "ko" to listOf(
            "사용자 이름", "사용자", "계정", "이메일"
        )
    )

    /**
     * Multi-language patterns for password fields
     */
    private val passwordPatterns = mapOf(
        "en" to listOf(
            "password", "pass", "pwd", "passcode", "pin", "secret"
        ),
        "vi" to listOf(
            "mật khẩu", "mật mã", "pin"
        ),
        "es" to listOf(
            "contraseña", "clave", "pin"
        ),
        "fr" to listOf(
            "mot de passe", "code", "pin"
        ),
        "de" to listOf(
            "passwort", "kennwort", "pin"
        ),
        "zh" to listOf(
            "密码", "口令", "pin"
        ),
        "ja" to listOf(
            "パスワード", "暗証番号", "pin"
        ),
        "ko" to listOf(
            "비밀번호", "암호", "pin"
        )
    )

    /**
     * Multi-language patterns for email fields
     */
    private val emailPatterns = mapOf(
        "en" to listOf(
            "email", "e-mail", "mail", "email address"
        ),
        "vi" to listOf(
            "email", "thư điện tử", "địa chỉ email"
        ),
        "es" to listOf(
            "correo", "correo electrónico", "email"
        ),
        "fr" to listOf(
            "courriel", "email", "adresse email"
        ),
        "de" to listOf(
            "e-mail", "email", "e-mail-adresse"
        ),
        "zh" to listOf(
            "邮箱", "电子邮件", "邮件地址"
        ),
        "ja" to listOf(
            "メール", "メールアドレス", "電子メール"
        ),
        "ko" to listOf(
            "이메일", "전자 메일", "메일 주소"
        )
    )

    /**
     * Regex patterns for field detection
     */
    private val regexPatterns = mapOf(
        FieldType.USERNAME to Regex(
            "(user|login|account|email|mail|id).*",
            RegexOption.IGNORE_CASE
        ),
        FieldType.PASSWORD to Regex(
            "(pass|pwd|secret|pin|code).*",
            RegexOption.IGNORE_CASE
        ),
        FieldType.EMAIL to Regex(
            "(email|mail|e-mail).*",
            RegexOption.IGNORE_CASE
        )
    )

    /**
     * Classifies a field based on multiple signals
     * 
     * @param hint The field hint text
     * @param idEntry The resource ID entry name
     * @param text The field text/label
     * @param htmlAttributes HTML attributes (for web views)
     * @return Classification result with confidence score
     */
    fun classifyField(
        hint: String?,
        idEntry: String?,
        text: String?,
        htmlAttributes: Map<String, String>? = null
    ): FieldClassification {
        val signals = mutableListOf<ClassificationSignal>()

        // Analyze hint
        hint?.let { signals.addAll(analyzeText(it)) }

        // Analyze ID entry
        idEntry?.let { signals.addAll(analyzeText(it)) }

        // Analyze text content
        text?.let { signals.addAll(analyzeText(it)) }

        // Analyze HTML attributes
        htmlAttributes?.let { signals.addAll(analyzeHtmlAttributes(it)) }

        // Aggregate signals and determine field type
        return aggregateSignals(signals)
    }

    /**
     * Analyzes text to extract classification signals
     * 
     * @param text The text to analyze
     * @return List of classification signals
     */
    private fun analyzeText(text: String): List<ClassificationSignal> {
        val signals = mutableListOf<ClassificationSignal>()
        val textLower = text.lowercase().trim()

        // Check against all language patterns
        for ((lang, patterns) in usernamePatterns) {
            for (pattern in patterns) {
                if (textLower.contains(pattern)) {
                    signals.add(
                        ClassificationSignal(
                            type = FieldType.USERNAME,
                            confidence = calculateConfidence(textLower, pattern),
                            source = "pattern_$lang"
                        )
                    )
                }
            }
        }

        for ((lang, patterns) in passwordPatterns) {
            for (pattern in patterns) {
                if (textLower.contains(pattern)) {
                    signals.add(
                        ClassificationSignal(
                            type = FieldType.PASSWORD,
                            confidence = calculateConfidence(textLower, pattern),
                            source = "pattern_$lang"
                        )
                    )
                }
            }
        }

        for ((lang, patterns) in emailPatterns) {
            for (pattern in patterns) {
                if (textLower.contains(pattern)) {
                    signals.add(
                        ClassificationSignal(
                            type = FieldType.EMAIL,
                            confidence = calculateConfidence(textLower, pattern),
                            source = "pattern_$lang"
                        )
                    )
                }
            }
        }

        // Check regex patterns
        for ((type, regex) in regexPatterns) {
            if (regex.matches(textLower)) {
                signals.add(
                    ClassificationSignal(
                        type = type,
                        confidence = HIGH_CONFIDENCE,
                        source = "regex"
                    )
                )
            }
        }

        return signals
    }

    /**
     * Analyzes HTML attributes for classification
     * 
     * @param attributes Map of HTML attributes
     * @return List of classification signals
     */
    private fun analyzeHtmlAttributes(attributes: Map<String, String>): List<ClassificationSignal> {
        val signals = mutableListOf<ClassificationSignal>()

        // Check input type attribute
        attributes["type"]?.let { inputType ->
            when (inputType.lowercase()) {
                "password" -> signals.add(
                    ClassificationSignal(
                        type = FieldType.PASSWORD,
                        confidence = HIGH_CONFIDENCE,
                        source = "html_type"
                    )
                )
                "email" -> signals.add(
                    ClassificationSignal(
                        type = FieldType.EMAIL,
                        confidence = HIGH_CONFIDENCE,
                        source = "html_type"
                    )
                )
                "text", "username" -> signals.add(
                    ClassificationSignal(
                        type = FieldType.USERNAME,
                        confidence = MEDIUM_CONFIDENCE,
                        source = "html_type"
                    )
                )
            }
        }

        // Check autocomplete attribute
        attributes["autocomplete"]?.let { autocomplete ->
            when (autocomplete.lowercase()) {
                "username", "email" -> signals.add(
                    ClassificationSignal(
                        type = FieldType.USERNAME,
                        confidence = HIGH_CONFIDENCE,
                        source = "html_autocomplete"
                    )
                )
                "current-password", "new-password" -> signals.add(
                    ClassificationSignal(
                        type = FieldType.PASSWORD,
                        confidence = HIGH_CONFIDENCE,
                        source = "html_autocomplete"
                    )
                )
            }
        }

        // Check name attribute
        attributes["name"]?.let { name ->
            signals.addAll(analyzeText(name))
        }

        // Check id attribute
        attributes["id"]?.let { id ->
            signals.addAll(analyzeText(id))
        }

        // Check placeholder attribute
        attributes["placeholder"]?.let { placeholder ->
            signals.addAll(analyzeText(placeholder))
        }

        return signals
    }

    /**
     * Calculates confidence score based on pattern match quality
     * 
     * @param text The full text
     * @param pattern The matched pattern
     * @return Confidence score (0.0 to 1.0)
     */
    private fun calculateConfidence(text: String, pattern: String): Double {
        // Exact match = high confidence
        if (text == pattern) {
            return HIGH_CONFIDENCE
        }

        // Pattern at start = high confidence
        if (text.startsWith(pattern)) {
            return HIGH_CONFIDENCE
        }

        // Pattern at end = medium confidence
        if (text.endsWith(pattern)) {
            return MEDIUM_CONFIDENCE
        }

        // Pattern in middle = lower confidence
        return LOW_CONFIDENCE
    }

    /**
     * Aggregates multiple classification signals into a final result
     * 
     * @param signals List of classification signals
     * @return Final classification result
     */
    private fun aggregateSignals(signals: List<ClassificationSignal>): FieldClassification {
        if (signals.isEmpty()) {
            return FieldClassification(
                type = FieldType.OTHER,
                confidence = 0.0,
                signals = emptyList()
            )
        }

        // Group signals by type
        val groupedSignals = signals.groupBy { it.type }

        // Calculate weighted confidence for each type
        val typeScores = groupedSignals.mapValues { (_, typeSignals) ->
            // Average confidence, weighted by source reliability
            typeSignals.map { it.confidence }.average()
        }

        // Find type with highest score
        val bestType = typeScores.maxByOrNull { it.value }?.key ?: FieldType.OTHER
        val bestConfidence = typeScores[bestType] ?: 0.0

        Log.d(TAG, "Classification result: $bestType (confidence: $bestConfidence)")
        Log.d(TAG, "Signals: ${signals.size}, Type scores: $typeScores")

        return FieldClassification(
            type = bestType,
            confidence = bestConfidence,
            signals = signals
        )
    }

    /**
     * Validates classification result
     * 
     * @param classification The classification to validate
     * @return true if classification is reliable
     */
    fun isReliableClassification(classification: FieldClassification): Boolean {
        return classification.confidence >= MEDIUM_CONFIDENCE
    }

    /**
     * Adds a custom pattern for field detection
     * 
     * @param type The field type
     * @param language The language code
     * @param patterns List of patterns to add
     */
    fun addCustomPatterns(type: FieldType, language: String, patterns: List<String>) {
        when (type) {
            FieldType.USERNAME -> {
                (usernamePatterns as MutableMap)[language] = 
                    (usernamePatterns[language] ?: emptyList()) + patterns
            }
            FieldType.PASSWORD -> {
                (passwordPatterns as MutableMap)[language] = 
                    (passwordPatterns[language] ?: emptyList()) + patterns
            }
            FieldType.EMAIL -> {
                (emailPatterns as MutableMap)[language] = 
                    (emailPatterns[language] ?: emptyList()) + patterns
            }
            else -> {
                Log.w(TAG, "Custom patterns not supported for type: $type")
            }
        }
    }
}

/**
 * Data class representing a classification signal
 */
data class ClassificationSignal(
    val type: FieldType,
    val confidence: Double,
    val source: String
)

/**
 * Data class representing the final classification result
 */
data class FieldClassification(
    val type: FieldType,
    val confidence: Double,
    val signals: List<ClassificationSignal>
)