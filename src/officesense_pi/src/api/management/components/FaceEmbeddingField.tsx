import React from 'react'
import { BasePropertyProps } from 'adminjs'
import { Label } from '@adminjs/design-system'

const FaceEmbeddingField: React.FC<BasePropertyProps> = ({ record, property }) => {
    const has = !!record?.params?.faceEmbedding
    return (
        <div style={{ marginBottom: '16px' }}>
            <Label>{property.label}</Label>
            <div style={{ marginTop: 6 }}>
                <span style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: '4px',
                    background: has ? '#dcfce7' : '#fee2e2',
                    color: has ? '#16a34a' : '#dc2626',
                }}>
                    {has ? 'SET' : 'UNSET'}
                </span>
            </div>
        </div>
    )
}

export default FaceEmbeddingField