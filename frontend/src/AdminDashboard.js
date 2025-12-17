import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [subscribers, setSubscribers] = useState(0);
    const [campaigns, setCampaigns] = useState(0);
    const [successRate, setSuccessRate] = useState('100%');
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedIcon, setSelectedIcon] = useState('🔔');
    const [buttons, setButtons] = useState([]);
    const [image, setImage] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [sentCampaigns, setSentCampaigns] = useState([]);
    
    const [formData, setFormData] = useState({
        name: '',
        title: '',
        message: '',
        link: 'https://www.retne.ai'
    });

    const icons = ['🔔', '🎉', '💰', '⭐', '🎁', '🚀', '❤️', '✅'];

    useEffect(() => {
        loadStats();
        loadTemplates();
    }, []);

    async function loadStats() {
        try {
            const res = await fetch('/stats');
            const data = await res.json();
            setSubscribers(data.count);
        } catch (e) {
            console.error('Error:', e);
        }
    }

    function loadTemplates() {
        const saved = localStorage.getItem('templates');
        if (saved) setTemplates(JSON.parse(saved));
    }

    function saveTemplate() {
        const templateName = prompt('Enter template name:');
        if (!templateName) return;

        const newTemplate = {
            id: Date.now(),
            name: templateName,
            icon: selectedIcon,
            title: formData.title,
            message: formData.message,
            link: formData.link,
            image: image,
            buttons: buttons
        };

        const updatedTemplates = [...templates, newTemplate];
        setTemplates(updatedTemplates);
        localStorage.setItem('templates', JSON.stringify(updatedTemplates));
        alert('✅ Template saved: ' + templateName);
    }

    function loadTemplate(template) {
        setFormData({
            name: template.name,
            title: template.title,
            message: template.message,
            link: template.link
        });
        setSelectedIcon(template.icon);
        setImage(template.image);
        setButtons(template.buttons);
        setCurrentStep(1);
        setActiveTab('campaigns');
    }

    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (file && file.size <= 2 * 1024 * 1024) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setImage(e.target.result);
            };
            reader.readAsDataURL(file);
        } else {
            alert('Image size must be less than 2MB');
        }
    }

    function addButton() {
        setButtons([...buttons, { id: Date.now(), text: '', url: '' }]);
    }

    function removeButton(id) {
        setButtons(buttons.filter(btn => btn.id !== id));
    }

    function updateButton(id, field, value) {
        setButtons(buttons.map(btn => btn.id === id ? { ...btn, [field]: value } : btn));
    }

    async function submitCampaign() {
        if (!formData.name || !formData.title || !formData.message) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            const res = await fetch('/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: selectedIcon + ' ' + formData.title,
                    message: formData.message,
                    url: formData.link,
                    icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png'
                })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            // Save to sent campaigns
            const newCampaign = {
                id: Date.now(),
                name: formData.name,
                icon: selectedIcon,
                title: formData.title,
                message: formData.message,
                link: formData.link,
                sent: result.sent,
                timestamp: new Date().toLocaleString()
            };
            setSentCampaigns([newCampaign, ...sentCampaigns]);

            alert('✅ Campaign sent to ' + result.sent + ' subscribers!');
            setCampaigns(campaigns + 1);
            
            // Reset form
            setFormData({ name: '', title: '', message: '', link: 'https://www.retne.ai' });
            setButtons([]);
            setImage(null);
            setSelectedIcon('🔔');
            setCurrentStep(1);
            setActiveTab('dashboard');
        } catch (err) {
            alert('❌ Error: ' + err.message);
        }
    }

    return (
        <div className="admin-container">
            {/* Sidebar */}
            <div className="sidebar">
                <div className="logo">📬 Zyra Push</div>
                {['dashboard', 'campaigns', 'automations', 'subscribers'].map(tab => (
                    <div
                        key={tab}
                        className={`nav-item ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab === 'dashboard' && '📊 Dashboard'}
                        {tab === 'campaigns' && '📧 Campaigns'}
                        {tab === 'automations' && '⚙️ Automations'}
                        {tab === 'subscribers' && '👥 Subscribers'}
                    </div>
                ))}
            </div>

            {/* Main Content */}
            <div className="main-content">
                {/* Dashboard Tab */}
                {activeTab === 'dashboard' && (
                    <div>
                        <div className="header">
                            <h1>Welcome to Zyra Push 👋</h1>
                            <p>Manage your push notifications efficiently</p>
                        </div>

                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-label">📈 Total Subscribers</div>
                                <div className="stat-value">{subscribers}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">📤 Campaigns Sent</div>
                                <div className="stat-value">{campaigns}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">✅ Success Rate</div>
                                <div className="stat-value">{successRate}</div>
                            </div>
                        </div>

                        <div className="section">
                            <div className="section-title">🚀 Quick Send Campaign</div>
                            <div className="form-group">
                                <label>Campaign Title</label>
                                <input type="text" placeholder="Big Sale Alert!" defaultValue="Big Sale Alert! 🚀" />
                            </div>
                            <div className="form-group">
                                <label>Message</label>
                                <textarea rows="3" placeholder="Enter your message..." defaultValue="Get 20% off on all items!"></textarea>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Link URL</label>
                                    <input type="text" placeholder="https://zyrajewel.co.in" defaultValue="https://zyrajewel.co.in" />
                                </div>
                            </div>
                            <button className="btn-primary">🚀 Send Campaign</button>
                        </div>
                    </div>
                )}

                {/* Campaigns Tab */}
                {activeTab === 'campaigns' && (
                    <div>
                        <div className="header">
                            <h1>📧 Campaigns</h1>
                            <p>Create and manage campaigns</p>
                        </div>

                        {currentStep === 1 && (
                            <div className="section">
                                <div className="step-header">
                                    <div>
                                        <div className="section-title" style={{ margin: 0 }}>Step 1: Campaign Details</div>
                                        <p style={{ color: '#999', fontSize: '13px', marginTop: '5px' }}>Add basic information</p>
                                    </div>
                                    <div className="step-badge">1/4</div>
                                </div>

                                <div className="form-group">
                                    <label>Campaign Name *</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g., Black Friday Sale"
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '25px' }}>
                                    <button className="btn-secondary" onClick={() => setActiveTab('dashboard')}>Cancel</button>
                                    <button className="btn-primary" onClick={() => setCurrentStep(2)}>Next: Message →</button>
                                </div>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="section">
                                <div className="step-header">
                                    <div>
                                        <div className="section-title" style={{ margin: 0 }}>Step 2: Message Content</div>
                                        <p style={{ color: '#999', fontSize: '13px', marginTop: '5px' }}>Compose your notification</p>
                                    </div>
                                    <div className="step-badge">2/4</div>
                                </div>

                                <div className="form-group">
                                    <label>Notification Title *</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g., Mega Sale Alert!"
                                        maxLength="50"
                                        value={formData.title}
                                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                                    />
                                    <small style={{ color: '#999', marginTop: '5px', display: 'block' }}>{formData.title.length}/50</small>
                                </div>

                                <div className="form-group">
                                    <label>Message *</label>
                                    <textarea 
                                        rows="4" 
                                        placeholder="e.g., Get 50% off on all items!"
                                        maxLength="200"
                                        value={formData.message}
                                        onChange={(e) => setFormData({...formData, message: e.target.value})}
                                    ></textarea>
                                    <small style={{ color: '#999', marginTop: '5px', display: 'block' }}>{formData.message.length}/200</small>
                                </div>

                                <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid #667eea' }}>
                                    <p style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>📱 Preview</p>
                                    <div style={{ background: 'white', padding: '12px', borderRadius: '6px' }}>
                                        <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>{selectedIcon} {formData.title || 'Title'}</strong>
                                        <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{formData.message || 'Message'}</p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '25px' }}>
                                    <button className="btn-secondary" onClick={() => setCurrentStep(1)}>← Back</button>
                                    <button className="btn-primary" onClick={() => setCurrentStep(3)}>Next: Media →</button>
                                </div>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div className="section">
                                <div className="step-header">
                                    <div>
                                        <div className="section-title" style={{ margin: 0 }}>Step 3: Media & Icon</div>
                                        <p style={{ color: '#999', fontSize: '13px', marginTop: '5px' }}>Add images and select icon</p>
                                    </div>
                                    <div className="step-badge">3/4</div>
                                </div>

                                {/* Image Upload */}
                                <div className="form-group">
                                    <label>Campaign Image (Optional)</label>
                                    <div 
                                        style={{
                                            border: '2px dashed #e8e8e8',
                                            padding: '20px',
                                            borderRadius: '8px',
                                            textAlign: 'center',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => document.getElementById('image-input').click()}
                                    >
                                        {image ? (
                                            <img src={image} style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '6px' }} alt="preview" />
                                        ) : (
                                            <div>
                                                <p style={{ fontSize: '20px', margin: 0 }}>📸</p>
                                                <p style={{ margin: '8px 0 0 0', color: '#999', fontSize: '13px' }}>Click to upload image</p>
                                            </div>
                                        )}
                                    </div>
                                    <input 
                                        type="file" 
                                        id="image-input" 
                                        accept="image/*" 
                                        style={{ display: 'none' }}
                                        onChange={handleImageUpload}
                                    />
                                </div>

                                {/* Icon Selection */}
                                <div className="form-group">
                                    <label>Notification Icon</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                        {icons.map(icon => (
                                            <label
                                                key={icon}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    cursor: 'pointer',
                                                    padding: '12px',
                                                    border: selectedIcon === icon ? '2px solid #667eea' : '2px solid #e8e8e8',
                                                    borderRadius: '8px',
                                                    backgroundColor: selectedIcon === icon ? '#f0f3ff' : 'white'
                                                }}
                                            >
                                                <input 
                                                    type="radio" 
                                                    name="icon" 
                                                    value={icon}
                                                    checked={selectedIcon === icon}
                                                    onChange={() => setSelectedIcon(icon)}
                                                />
                                                <span style={{ fontSize: '20px' }}>{icon}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="form-group">
                                    <label>Action Buttons (Optional)</label>
                                    {buttons.map(btn => (
                                        <div key={btn.id} style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                            <input 
                                                type="text" 
                                                placeholder="Button text"
                                                maxLength="20"
                                                value={btn.text}
                                                onChange={(e) => updateButton(btn.id, 'text', e.target.value)}
                                                style={{ flex: 1 }}
                                            />
                                            <input 
                                                type="text" 
                                                placeholder="Button URL"
                                                value={btn.url}
                                                onChange={(e) => updateButton(btn.id, 'url', e.target.value)}
                                                style={{ flex: 1.5 }}
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => removeButton(btn.id)}
                                                style={{ background: '#ff6b6b', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px' }}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                    <button 
                                        type="button" 
                                        onClick={addButton}
                                        className="btn-primary"
                                        style={{ fontSize: '13px', padding: '8px 16px', width: 'auto' }}
                                    >
                                        + Add Button
                                    </button>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '25px' }}>
                                    <button className="btn-secondary" onClick={() => setCurrentStep(2)}>← Back</button>
                                    <button className="btn-primary" onClick={() => setCurrentStep(4)}>Next: Send →</button>
                                </div>
                            </div>
                        )}

                        {currentStep === 4 && (
                            <div className="section">
                                <div className="step-header">
                                    <div>
                                        <div className="section-title" style={{ margin: 0 }}>Step 4: Review & Send</div>
                                        <p style={{ color: '#999', fontSize: '13px', marginTop: '5px' }}>Final preview before sending</p>
                                    </div>
                                    <div className="step-badge" style={{ background: '#667eea', color: 'white' }}>4/4</div>
                                </div>

                                {/* Campaign Preview */}
                                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px', marginBottom: '25px' }}>
                                    <p style={{ fontSize: '12px', color: '#999', marginBottom: '15px', fontWeight: 600 }}>📱 Desktop Preview:</p>
                                    <div style={{
                                        background: 'white',
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '8px',
                                        padding: '20px',
                                        maxWidth: '500px'
                                    }}>
                                        {image && (
                                            <img src={image} alt="campaign" style={{ width: '100%', borderRadius: '8px', marginBottom: '12px', maxHeight: '200px', objectFit: 'cover' }} />
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                            <span style={{ fontSize: '28px' }}>{selectedIcon}</span>
                                            <div style={{ flex: 1 }}>
                                                <strong style={{ display: 'block', fontSize: '16px', marginBottom: '6px', color: '#1a1a2e' }}>
                                                    {formData.title}
                                                </strong>
                                                <p style={{ fontSize: '14px', color: '#666', margin: 0, lineHeight: '1.5' }}>
                                                    {formData.message}
                                                </p>
                                                {buttons.length > 0 && (
                                                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                        {buttons.map(btn => (
                                                            <a
                                                                key={btn.id}
                                                                href={btn.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{
                                                                    padding: '8px 14px',
                                                                    background: '#667eea',
                                                                    color: 'white',
                                                                    borderRadius: '6px',
                                                                    textDecoration: 'none',
                                                                    fontSize: '12px',
                                                                    fontWeight: 600
                                                                }}
                                                            >
                                                                {btn.text}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Campaign Info */}
                                <div style={{ background: '#ecfdf5', padding: '15px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid #10b981' }}>
                                    <p style={{ margin: 0, color: '#047857', fontSize: '14px' }}>
                                        <strong>✅ Ready to send</strong><br />
                                        <span style={{ fontSize: '12px' }}>
                                            Campaign: <strong>{formData.name}</strong><br/>
                                            Recipients: <strong>{subscribers}</strong> subscribers<br/>
                                            Link: <strong style={{ wordBreak: 'break-all' }}>{formData.link}</strong>
                                        </span>
                                    </p>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '25px', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button className="btn-secondary" onClick={() => setCurrentStep(3)}>← Back</button>
                                        <button className="btn-primary" onClick={saveTemplate} style={{ background: '#667eea' }}>💾 Save Template</button>
                                    </div>
                                    <button className="btn-success" onClick={submitCampaign}>🚀 Send to All</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Templates Tab */}
                {activeTab === 'campaigns' && currentStep === 1 && templates.length > 0 && (
                    <div className="section" style={{ marginBottom: '25px' }}>
                        <div className="section-title">📋 Saved Templates</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                            {templates.map(template => (
                                <div key={template.id} style={{
                                    background: '#f8f9fa',
                                    padding: '15px',
                                    borderRadius: '8px',
                                    border: '1px solid #e0e0e0',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s',
                                    hover: { borderColor: '#667eea' }
                                }}>
                                    <strong style={{ display: 'block', marginBottom: '8px', color: '#1a1a2e' }}>
                                        {template.icon} {template.name}
                                    </strong>
                                    <p style={{ fontSize: '12px', color: '#666', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                                        {template.title}
                                    </p>
                                    <button
                                        onClick={() => loadTemplate(template)}
                                        style={{
                                            background: '#667eea',
                                            color: 'white',
                                            border: 'none',
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            width: '100%'
                                        }}
                                    >
                                        Use Template
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Sent Campaigns Tab */}
                {activeTab === 'campaigns' && currentStep === 1 && sentCampaigns.length > 0 && (
                    <div className="section" style={{ marginBottom: '25px' }}>
                        <div className="section-title">📤 Recently Sent</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                            {sentCampaigns.map(camp => (
                                <div key={camp.id} style={{
                                    background: '#ecfdf5',
                                    padding: '15px',
                                    borderRadius: '8px',
                                    borderLeft: '4px solid #10b981'
                                }}>
                                    <strong style={{ display: 'block', marginBottom: '8px', color: '#1a1a2e' }}>
                                        {camp.icon} {camp.name}
                                    </strong>
                                    <p style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>
                                        {camp.title}
                                    </p>
                                    <div style={{ fontSize: '11px', color: '#999' }}>
                                        ✅ Sent to {camp.sent} subscribers<br/>
                                        {camp.timestamp}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Automations Tab */}
                {activeTab === 'automations' && (
                    <div>
                        <div className="header">
                            <h1>⚙️ Automations</h1>
                            <p>Automated campaigns</p>
                        </div>

                        <div className="section">
                            <div className="section-title">Welcome Notifications</div>
                            <div style={{ background: '#ecfdf5', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                                <strong>✅ Active</strong>
                                <p style={{ color: '#666', fontSize: '12px', marginTop: '5px' }}>Automatic welcome message sent when users subscribe</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Subscribers Tab */}
                {activeTab === 'subscribers' && (
                    <div>
                        <div className="header">
                            <h1>👥 Subscribers</h1>
                            <p>Manage subscriber list</p>
                        </div>

                        <div className="section">
                            <div style={{ background: '#ecfdf5', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                                <strong>Total Active Subscribers: <span style={{ color: '#667eea' }}>{subscribers}</span></strong>
                                <p style={{ color: '#666', fontSize: '12px', marginTop: '5px' }}>All active subscriptions ready to receive campaigns</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
