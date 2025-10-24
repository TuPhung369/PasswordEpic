package com.passwordepic.mobile.autofill

import android.os.Bundle
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity
import com.passwordepic.mobile.R

/**
 * Test Activity to verify Autofill Framework works
 * 
 * This simple activity has two text fields that should trigger
 * PasswordEpic autofill when clicked.
 * 
 * Use this to test if the autofill service is working at all,
 * independent of Chrome or any browser issues.
 */
class TestAutofillActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Create a simple layout with two edit texts
        setContentView(android.R.layout.activity_list_item)
        
        // Mark this activity as allowing autofill
        window.decorView.importantForAutofill = android.view.View.IMPORTANT_FOR_AUTOFILL_YES
    }
}