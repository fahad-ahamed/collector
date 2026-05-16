import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get("Authorization")?.replace("Bearer ", "");

  if (!accessToken) {
    return NextResponse.json({ error: "No access token" }, { status: 401 });
  }

  try {
    const allContacts: any[] = [];
    let nextPageToken: string | null = null;

    // Paginate through all contacts
    do {
      const url = new URL("https://people.googleapis.com/v1/people/me/connections");
      url.searchParams.set("pageSize", "1000");
      url.searchParams.set("personFields", "names,phoneNumbers,emailAddresses,organizations");
      if (nextPageToken) {
        url.searchParams.set("pageToken", nextPageToken);
      }

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("People API error:", err);
        return NextResponse.json(
          { error: "Failed to fetch contacts", details: err },
          { status: res.status }
        );
      }

      const data = await res.json();
      if (data.connections) {
        allContacts.push(...data.connections);
      }
      nextPageToken = data.nextPageToken || null;
    } while (nextPageToken);

    // Map to clean contact format
    const contacts = allContacts
      .filter((person: any) => person.names || person.phoneNumbers)
      .map((person: any, i: number) => ({
        id: `g-${i + 1}`,
        name: person.names?.[0]?.displayName || "Unknown",
        phone: person.phoneNumbers?.[0]?.value || "",
        email: person.emailAddresses?.[0]?.value || undefined,
        organization: person.organizations?.[0]?.name || undefined,
      }))
      .filter((c: any) => c.phone); // Only keep contacts with phone numbers

    return NextResponse.json({ contacts, total: contacts.length });
  } catch (error: any) {
    console.error("Contacts API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
