package com.passwordepic.mobile.autofill

import android.app.assist.AssistStructure
import android.text.InputType
import android.util.Log
import android.view.View
import android.view.autofill.AutofillId

/**
 * ViewNodeParser
 * 
 * Parses Android AssistStructure to identify autofillable fields.
 * Handles both native Android views and web views.
 * 
 * Features:
 * - Recursive view hierarchy traversal
 * - Username/password field detection
 * - Domain extraction from URLs and package names
 * - Support for various input field types
 * - Web view and native form handling
 */
class ViewNodeParser {

    companion object {
        private const val TAG = "ViewNodeParser"
    }

    /**
     * Parses an AssistStructure to extract autofillable fields
     * 
     * @param structure The AssistStructure from autofill request
     * @return ParsedStructureData containing fields and domain info
     */
    fun parseStructure(structure: AssistStructure): ParsedStructureData {
        Log.d(TAG, "Parsing AssistStructure with ${structure.windowNodeCount} windows")

        val fields = mutableListOf<AutofillField>()
        var domain: String? = null
        var packageName: String? = null

        // Iterate through all windows in the structure
        for (i in 0 until structure.windowNodeCount) {
            val windowNode = structure.getWindowNodeAt(i)
            val rootNode = windowNode.rootViewNode

            // Extract package name from the first window
            if (i == 0) {
                packageName = rootNode.idPackage ?: structure.activityComponent.packageName
                Log.d(TAG, "Package name: $packageName")
            }

            // Extract domain from web view if present
            if (domain == null) {
                domain = extractDomainFromNode(rootNode)
            }

            // Recursively parse the view hierarchy
            parseViewNode(rootNode, fields)
        }

        // If no domain found from web view, use package name
        if (domain.isNullOrEmpty() && !packageName.isNullOrEmpty()) {
            domain = packageName
            Log.d(TAG, "Using package name as domain: $domain")
        }

        Log.d(TAG, "Parsing complete. Found ${fields.size} autofillable fields")
        Log.d(TAG, "Domain: $domain, Package: $packageName")

        return ParsedStructureData(
            domain = domain ?: "",
            packageName = packageName ?: "",
            fields = fields
        )
    }

    /**
     * Recursively parses a ViewNode and its children
     * 
     * @param node The ViewNode to parse
     * @param fields Mutable list to collect autofillable fields
     */
    private fun parseViewNode(
        node: AssistStructure.ViewNode,
        fields: MutableList<AutofillField>
    ) {
        // Check if this node is autofillable
        val autofillId = node.autofillId
        if (autofillId != null) {
            val field = analyzeNode(node)
            if (field != null) {
                fields.add(field)
                Log.d(TAG, "Found autofillable field: ${field.type} (${field.hint})")
            }
        }

        // Recursively parse children
        for (i in 0 until node.childCount) {
            val childNode = node.getChildAt(i)
            parseViewNode(childNode, fields)
        }
    }

    /**
     * Analyzes a ViewNode to determine if it's autofillable
     * 
     * @param node The ViewNode to analyze
     * @return AutofillField if autofillable, null otherwise
     */
    private fun analyzeNode(node: AssistStructure.ViewNode): AutofillField? {
        val autofillId = node.autofillId ?: return null

        // Skip if not visible or not enabled
        if (node.visibility != View.VISIBLE) {
            return null
        }

        // Determine field type using multiple heuristics
        val fieldType = determineFieldType(node)

        // Only process username, password, and email fields
        if (fieldType !in listOf(FieldType.USERNAME, FieldType.PASSWORD, FieldType.EMAIL)) {
            return null
        }

        // Extract current value if available
        val value = node.autofillValue?.let {
            if (it.isText) it.textValue?.toString() else null
        }

        // Get hint for display
        val hint = node.hint ?: node.autofillHints?.firstOrNull() ?: node.idEntry

        return AutofillField(
            autofillId = autofillId,
            type = fieldType,
            hint = hint,
            value = value
        )
    }

    /**
     * Determines the field type using multiple detection methods
     * 
     * @param node The ViewNode to analyze
     * @return FieldType enum value
     */
    private fun determineFieldType(node: AssistStructure.ViewNode): FieldType {
        // Method 1: Check autofill hints (most reliable)
        val hintsType = AutofillHelper.getFieldTypeFromHints(node.autofillHints)
        if (hintsType != FieldType.OTHER) {
            return hintsType
        }

        // Method 2: Check input type for password fields
        val inputType = node.inputType
        if (AutofillHelper.isPasswordInputType(inputType)) {
            return FieldType.PASSWORD
        }

        // Method 3: Check HTML input type (for web views)
        val htmlInfo = node.htmlInfo
        if (htmlInfo != null) {
            val htmlInputType = htmlInfo.attributes
                ?.firstOrNull { it.first == "type" }
                ?.second

            val htmlType = AutofillHelper.getFieldTypeFromInputType(htmlInputType)
            if (htmlType != FieldType.OTHER) {
                return htmlType
            }
        }

        // Method 4: Check resource ID entry name
        val idType = AutofillHelper.getFieldTypeFromId(node.idEntry)
        if (idType != FieldType.OTHER) {
            return idType
        }

        // Method 5: Check hint text
        val hintType = AutofillHelper.getFieldTypeFromId(node.hint)
        if (hintType != FieldType.OTHER) {
            return hintType
        }

        // Method 6: Check text content (for labels)
        val textType = AutofillHelper.getFieldTypeFromId(node.text?.toString())
        if (textType != FieldType.OTHER) {
            return textType
        }

        return FieldType.OTHER
    }

    /**
     * Extracts domain from a ViewNode (for web views)
     * 
     * @param node The ViewNode to extract domain from
     * @return Domain string or null
     */
    private fun extractDomainFromNode(node: AssistStructure.ViewNode): String? {
        // Check web domain first
        node.webDomain?.let { webDomain ->
            val domain = AutofillHelper.extractDomain(webDomain)
            if (domain != null) {
                Log.d(TAG, "✅ Extracted domain from webDomain: $domain")
                return domain
            }
        }

        // Check web scheme + domain (build URL)
        if (node.webScheme != null && node.webDomain != null) {
            val url = "${node.webScheme}://${node.webDomain}"
            val domain = AutofillHelper.extractDomain(url)
            if (domain != null) {
                Log.d(TAG, "✅ Extracted domain from webScheme+webDomain: $domain")
                return domain
            }
        }

        // Fallback: Try to extract domain from text content or hints
        // Chrome sometimes puts URL in accessibility text
        val text = node.text?.toString()
        if (!text.isNullOrEmpty()) {
            val domain = AutofillHelper.extractDomain(text)
            if (domain != null) {
                Log.d(TAG, "✅ Extracted domain from node text: $domain")
                return domain
            }
        }

        // Try hint text
        val hint = node.hint
        if (!hint.isNullOrEmpty()) {
            val domain = AutofillHelper.extractDomain(hint)
            if (domain != null) {
                Log.d(TAG, "✅ Extracted domain from node hint: $domain")
                return domain
            }
        }

        // Try HTML attributes for web forms
        // htmlInfo.attributes is a List of Pair<String, String>
        node.htmlInfo?.attributes?.forEach { attr ->
            if (attr != null) {
                @Suppress("UNCHECKED_CAST")
                val pair = attr as? Pair<String?, String?>
                if (pair != null) {
                    val attrName = pair.first?.toString()?.lowercase() ?: ""
                    val attrValue = pair.second?.toString() ?: ""
                    if (attrName == "action" || attrName == "data") {
                        val domain = AutofillHelper.extractDomain(attrValue)
                        if (domain != null) {
                            Log.d(TAG, "✅ Extracted domain from HTML $attrName: $domain")
                            return domain
                        }
                    }
                }
            }
        }

        // Recursively check children
        for (i in 0 until node.childCount) {
            val childDomain = extractDomainFromNode(node.getChildAt(i))
            if (childDomain != null) {
                return childDomain
            }
        }

        Log.d(TAG, "⚠️ Could not extract domain from node")
        return null
    }

    /**
     * Extracts all text content from a ViewNode and its children
     * (useful for debugging and analysis)
     * 
     * @param node The ViewNode to extract text from
     * @return List of text strings
     */
    private fun extractAllText(node: AssistStructure.ViewNode): List<String> {
        val texts = mutableListOf<String>()

        node.text?.toString()?.let { texts.add(it) }
        node.hint?.let { texts.add(it) }
        node.contentDescription?.toString()?.let { texts.add(it) }

        for (i in 0 until node.childCount) {
            texts.addAll(extractAllText(node.getChildAt(i)))
        }

        return texts
    }

    /**
     * Logs detailed information about a ViewNode (for debugging)
     * 
     * @param node The ViewNode to log
     * @param depth Indentation depth
     */
    private fun logNodeDetails(node: AssistStructure.ViewNode, depth: Int = 0) {
        val indent = "  ".repeat(depth)
        
        Log.d(TAG, "${indent}ViewNode:")
        Log.d(TAG, "${indent}  ID: ${node.idEntry}")
        Log.d(TAG, "${indent}  Class: ${node.className}")
        Log.d(TAG, "${indent}  Autofill ID: ${node.autofillId}")
        Log.d(TAG, "${indent}  Autofill Type: ${node.autofillType}")
        Log.d(TAG, "${indent}  Autofill Hints: ${node.autofillHints?.joinToString()}")
        Log.d(TAG, "${indent}  Input Type: ${node.inputType}")
        Log.d(TAG, "${indent}  Hint: ${node.hint}")
        Log.d(TAG, "${indent}  Text: ${AutofillHelper.sanitizeForLog(node.text?.toString())}")
        Log.d(TAG, "${indent}  Web Domain: ${node.webDomain}")
        Log.d(TAG, "${indent}  Visibility: ${node.visibility}")
        
        node.htmlInfo?.let { htmlInfo ->
            Log.d(TAG, "${indent}  HTML Tag: ${htmlInfo.tag}")
            htmlInfo.attributes?.forEach { attr ->
                Log.d(TAG, "${indent}    ${attr.first} = ${attr.second}")
            }
        }

        for (i in 0 until node.childCount) {
            logNodeDetails(node.getChildAt(i), depth + 1)
        }
    }

    /**
     * Validates that the parsed data contains required fields
     * 
     * @param data The parsed structure data
     * @return true if valid for autofill
     */
    fun validateParsedData(data: ParsedStructureData): Boolean {
        // Must have at least a password field
        val hasPassword = data.fields.any { it.type == FieldType.PASSWORD }
        
        // Must have a valid domain
        val hasDomain = data.domain.isNotEmpty()

        return hasPassword && hasDomain
    }

    /**
     * Groups fields by their likely form association
     * (useful for complex pages with multiple forms)
     * 
     * @param fields List of autofill fields
     * @return Map of form groups
     */
    fun groupFieldsByForm(fields: List<AutofillField>): Map<String, List<AutofillField>> {
        // Simple grouping by proximity (could be enhanced)
        return fields.groupBy { field ->
            // Use autofill ID hash as a simple grouping key
            (field.autofillId.hashCode() / 1000).toString()
        }
    }
}