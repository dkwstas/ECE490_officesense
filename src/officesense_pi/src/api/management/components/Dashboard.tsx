import React, { useEffect, useState } from "react";
import { Box, H2, Text, Loader } from "@adminjs/design-system";
import { ApiClient } from "adminjs";

type Session = {
    realUserId: string;
    firstName: string;
    lastName: string;
    pseudoId: string;
    pseudoName: string;
};

const Dashboard = () => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [updated, setUpdated] = useState<string>("");

    const load = async () => {
        try {
            const res = await fetch("/admin/map", { credentials: "include" });
            const data = await res.json();
            setSessions(data);
            setUpdated(new Date().toLocaleTimeString());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const interval = setInterval(load, 10000);
        return () => clearInterval(interval);
    }, []);

    const initials = (first: string, last: string) =>
        ((first?.[0] ?? "") + (last?.[0] ?? "")).toUpperCase() || "?";

    return (
        <Box padding="xl">
            <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                marginBottom="xl"
            >
                <Box>
                    <H2>OfficeSense Admin Dashboard</H2>
                    <Text color="grey60">Live Redis sessions mapped to registered users</Text>
                </Box>
                <Box display="flex" alignItems="center">
                    <Text color="grey60" fontSize="sm" marginRight="md">
                        Updated {updated}
                    </Text>
                    <Box
                        as="button"
                        onClick={load}
                        style={{
                            padding: "6px 14px",
                            borderRadius: "6px",
                            border: "1px solid #e5e7eb",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: "13px",
                        }}
                    >
                        Refresh
                    </Box>
                </Box>
            </Box>

            {loading ? (
                <Loader />
            ) : sessions.length === 0 ? (
                <Text color="grey60">No active sessions.</Text>
            ) : (
                <Box
                    style={{
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px",
                        overflow: "hidden",
                    }}
                >
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                        <thead>
                            <tr style={{ background: "#fafafa" }}>
                                {["User", "Real UUID", "Pseudo UUID", "Pseudo name"].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            textAlign: "left",
                                            padding: "10px 16px",
                                            fontSize: "11px",
                                            color: "#9ca3af",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            borderBottom: "1px solid #f3f4f6",
                                            fontWeight: 500,
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map((s) => (
                                <tr
                                    key={s.realUserId}
                                    style={{ borderBottom: "1px solid #f9fafb" }}
                                >
                                    <td style={{ padding: "12px 16px" }}>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: "50%",
                                                    background: "#eff6ff",
                                                    color: "#2563eb",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontSize: "11px",
                                                    fontWeight: 600,
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {initials(s.firstName, s.lastName)}
                                            </div>
                                            {s.firstName} {s.lastName}
                                        </div>
                                    </td>
                                    <td
                                        style={{
                                            padding: "12px 16px",
                                            fontFamily: "monospace",
                                            fontSize: "12px",
                                            color: "#6b7280",
                                        }}
                                    >
                                        {s.realUserId}
                                    </td>
                                    <td
                                        style={{
                                            padding: "12px 16px",
                                            fontFamily: "monospace",
                                            fontSize: "12px",
                                            color: "#6b7280",
                                        }}
                                    >
                                        {s.pseudoId}
                                    </td>
                                    <td style={{ padding: "12px 16px" }}>{s.pseudoName ?? "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Box>
            )}
        </Box>
    );
};

export default Dashboard;
