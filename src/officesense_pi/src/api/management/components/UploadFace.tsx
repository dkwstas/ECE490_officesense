import React, { useState, useRef } from "react";
import { Box, H3, Text, Button, MessageBox } from "@adminjs/design-system";
import type { ActionProps } from "adminjs";

const UploadFace: React.FC<ActionProps> = ({ record, action }) => {
    const [preview, setPreview] = useState<string | null>(null);
    const [base64, setBase64] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(
        null
    );
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            setPreview(result);
            setBase64(result.split(",")[1] ?? null); // strip data:image/jpeg;base64,
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (!base64) return;
        setLoading(true);
        setNotice(null);
        try {
            const res = await fetch(
                `/admin/api/resources/User/records/${record?.params.id}/uploadFace`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ base64 }),
                }
            );
            const data = await res.json();
            setNotice(data.notice);
        } catch (e: any) {
            setNotice({ message: e.message, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box padding="xl">
            <H3 marginBottom="md">Upload face image</H3>
            <Text color="grey60" marginBottom="lg">
                Upload a JPEG photo of the user to generate and store their face embedding.
            </Text>

            {notice && (
                <MessageBox
                    message={notice.message}
                    variant={notice.type === "success" ? "success" : "danger"}
                    marginBottom="lg"
                />
            )}

            <Box marginBottom="lg">
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg"
                    onChange={handleFile}
                    style={{ display: "none" }}
                />
                <Button onClick={() => inputRef.current?.click()} variant="outlined">
                    Choose JPEG
                </Button>
            </Box>

            {preview && (
                <Box marginBottom="lg">
                    <img
                        src={preview}
                        alt="Preview"
                        style={{
                            width: 160,
                            height: 160,
                            objectFit: "cover",
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                        }}
                    />
                </Box>
            )}

            <Button onClick={handleSubmit} disabled={!base64 || loading} variant="contained">
                {loading ? "Processing…" : "Save embedding"}
            </Button>
        </Box>
    );
};

export default UploadFace;
