import { NextResponse } from "next/server";
import { withAuth } from "@/lib/apiRoute";

export const POST = withAuth(async (req, { userId, role }) => {
  try {
    const formData = await req.formData();
    const photo = formData.get("photo");
    if (!(photo instanceof File) || photo.size === 0) {
      return NextResponse.json({ error: "Choose a profile photo to upload" }, { status: 400 });
    }

    const serviceForm = new FormData();
    serviceForm.append("photo", photo, photo.name);
    const response = await fetch(`${process.env.USER_SERVICE_URL ?? "http://localhost:5003"}/api/users/me/photo`, {
      method: "POST",
      headers: {
        "x-internal-service-token": process.env.INTERNAL_SERVICE_TOKEN ?? "",
        "x-user-id": userId,
        "x-user-role": role,
      },
      body: serviceForm,
      cache: "no-store",
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: "Profile photo upload failed" }, { status: 500 });
  }
});
