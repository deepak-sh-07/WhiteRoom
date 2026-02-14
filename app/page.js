"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [userId, setUserId] = useState(null);
  const router = useRouter();

  const check = async () => {
    const res = await fetch("/api/me", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials:"include",
    });

    const data = await res.json(); // ✅ FIX

    console.log(data);

    if (res.status !== 200) {
      router.push("/login");
      return;
    }

    setUserId(data.userId);
  };

  useEffect(() => {
    check();
  }, []);

  return (
    <div>
      This is the dashboard
      <div>
        User ID: {userId ?? "Loading..."}
      </div>

      <button onClick={() => router.push("/create")}>Create Room</button>
      <button onClick={() => router.push("/join")}>Join Room</button>
    </div>
  );
}
