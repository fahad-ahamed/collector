package com.contactcollector.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.ContactsContract
import android.view.View
import android.widget.TextView
import android.widget.ProgressBar
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.gson.Gson
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException

class MainActivity : AppCompatActivity() {

    companion object {
        private const val CONTACTS_PERMISSION_CODE = 100
        // IMPORTANT: Change this URL to your deployed website URL
        private const val WEBSITE_BASE_URL = "https://your-website-url.vercel.app"
    }

    private lateinit var tvStatus: TextView
    private lateinit var tvDetail: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var btnAllow: Button
    private lateinit var btnViewWebsite: Button
    private lateinit var layoutSuccess: View
    private lateinit var layoutPermission: View
    private lateinit var layoutLoading: View

    private var viewUrl: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize views
        tvStatus = findViewById(R.id.tvStatus)
        tvDetail = findViewById(R.id.tvDetail)
        progressBar = findViewById(R.id.progressBar)
        btnAllow = findViewById(R.id.btnAllow)
        btnViewWebsite = findViewById(R.id.btnViewWebsite)
        layoutSuccess = findViewById(R.id.layoutSuccess)
        layoutPermission = findViewById(R.id.layoutPermission)
        layoutLoading = findViewById(R.id.layoutLoading)

        btnAllow.setOnClickListener {
            requestContactPermission()
        }

        btnViewWebsite.setOnClickListener {
            viewUrl?.let { url ->
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                startActivity(intent)
            }
        }

        // Check if permission is already granted
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CONTACTS)
            == PackageManager.PERMISSION_GRANTED
        ) {
            readAndUploadContacts()
        } else {
            showPermissionScreen()
        }
    }

    private fun showPermissionScreen() {
        layoutPermission.visibility = View.VISIBLE
        layoutLoading.visibility = View.GONE
        layoutSuccess.visibility = View.GONE
    }

    private fun requestContactPermission() {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.READ_CONTACTS),
            CONTACTS_PERMISSION_CODE
        )
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CONTACTS_PERMISSION_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                readAndUploadContacts()
            } else {
                tvStatus.text = "Permission Denied"
                tvDetail.text = "Contact permission is required to read your contacts. Please try again."
            }
        }
    }

    private fun readAndUploadContacts() {
        layoutPermission.visibility = View.GONE
        layoutLoading.visibility = View.VISIBLE
        layoutSuccess.visibility = View.GONE
        tvStatus.text = "Reading Contacts..."
        tvDetail.text = "Please wait while we read all your contacts"

        Thread {
            val contacts = readAllContacts()

            runOnUiThread {
                tvStatus.text = "Uploading Contacts..."
                tvDetail.text = "Sending ${contacts.size} contacts to website..."
            }

            uploadContacts(contacts)
        }.start()
    }

    private fun readAllContacts(): List<Map<String, String?>> {
        val contacts = mutableListOf<Map<String, String?>>()

        val cursor = contentResolver.query(
            ContactsContract.Contacts.CONTENT_URI,
            null,
            null,
            null,
            ContactsContract.Contacts.DISPLAY_NAME + " ASC"
        )

        cursor?.use {
            val idIndex = it.getColumnIndex(ContactsContract.Contacts._ID)
            val nameIndex = it.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME)
            val hasPhoneIndex = it.getColumnIndex(ContactsContract.Contacts.HAS_PHONE_NUMBER)

            while (it.moveToNext()) {
                val id = it.getString(idIndex) ?: continue
                val name = it.getString(nameIndex) ?: "Unknown"
                val hasPhone = it.getInt(hasPhoneIndex) > 0

                if (hasPhone) {
                    // Get phone numbers
                    val phoneCursor = contentResolver.query(
                        ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                        null,
                        ContactsContract.CommonDataKinds.Phone.CONTACT_ID + " = ?",
                        arrayOf(id),
                        null
                    )

                    var phone = ""
                    phoneCursor?.use { pc ->
                        if (pc.moveToFirst()) {
                            val phoneIndex = pc.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                            phone = pc.getString(phoneIndex) ?: ""
                        }
                    }

                    if (phone.isNotEmpty()) {
                        // Get email
                        var email: String? = null
                        val emailCursor = contentResolver.query(
                            ContactsContract.CommonDataKinds.Email.CONTENT_URI,
                            null,
                            ContactsContract.CommonDataKinds.Email.CONTACT_ID + " = ?",
                            arrayOf(id),
                            null
                        )
                        emailCursor?.use { ec ->
                            if (ec.moveToFirst()) {
                                val emailIndex = ec.getColumnIndex(ContactsContract.CommonDataKinds.Email.DATA)
                                email = ec.getString(emailIndex)
                            }
                        }

                        // Get organization
                        var organization: String? = null
                        val orgCursor = contentResolver.query(
                            ContactsContract.Data.CONTENT_URI,
                            null,
                            ContactsContract.Data.CONTACT_ID + " = ? AND " +
                                    ContactsContract.Data.MIMETYPE + " = ?",
                            arrayOf(id, ContactsContract.CommonDataKinds.Organization.CONTENT_ITEM_TYPE),
                            null
                        )
                        orgCursor?.use { oc ->
                            if (oc.moveToFirst()) {
                                val orgIndex = oc.getColumnIndex(ContactsContract.CommonDataKinds.Organization.COMPANY)
                                organization = oc.getString(orgIndex)
                            }
                        }

                        contacts.add(mapOf(
                            "id" to id,
                            "name" to name,
                            "phone" to phone,
                            "email" to email,
                            "organization" to organization
                        ))
                    }
                }
            }
        }

        return contacts
    }

    private fun uploadContacts(contacts: List<Map<String, String?>>) {
        val gson = Gson()
        val jsonBody = gson.toJson(mapOf("contacts" to contacts))

        val requestBody = jsonBody.toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url("$WEBSITE_BASE_URL/api/contacts/upload")
            .post(requestBody)
            .build()

        val client = OkHttpClient()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    layoutLoading.visibility = View.GONE
                    tvStatus.text = "Upload Failed"
                    tvDetail.text = "Could not connect to server. Error: ${e.message}\n\nPlease check your internet connection and try again."
                    layoutPermission.visibility = View.VISIBLE
                    btnAllow.text = "Try Again"
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string()

                if (response.isSuccessful && responseBody != null) {
                    try {
                        val result = gson.fromJson(responseBody, Map::class.java)
                        val sessionId = result["id"] as? String ?: ""
                        val count = result["count"] as? Double ?: 0.0
                        viewUrl = "$WEBSITE_BASE_URL/view/$sessionId"

                        runOnUiThread {
                            layoutLoading.visibility = View.GONE
                            layoutSuccess.visibility = View.VISIBLE
                            tvStatus.text = "Contacts Uploaded!"
                            tvDetail.text = "${count.toInt()} contacts have been sent to the website successfully.\n\nTap 'View on Website' to see all your contacts in vCard format."
                            btnViewWebsite.visibility = View.VISIBLE
                        }
                    } catch (e: Exception) {
                        runOnUiThread {
                            layoutLoading.visibility = View.GONE
                            tvStatus.text = "Error"
                            tvDetail.text = "Something went wrong: ${e.message}"
                            layoutPermission.visibility = View.VISIBLE
                            btnAllow.text = "Try Again"
                        }
                    }
                } else {
                    runOnUiThread {
                        layoutLoading.visibility = View.GONE
                        tvStatus.text = "Upload Failed"
                        tvDetail.text = "Server error: ${response.code}\nPlease try again."
                        layoutPermission.visibility = View.VISIBLE
                        btnAllow.text = "Try Again"
                    }
                }
            }
        })
    }
}
