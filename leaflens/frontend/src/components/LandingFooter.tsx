import React, { useState } from 'react'
import { PotMascots } from './PotMascots'

interface LandingFooterProps {
  onStartScan: () => void
}

type ModalTab = 'plants' | 'how-it-works' | 'about' | null

export const LandingFooter: React.FC<LandingFooterProps> = ({ onStartScan }) => {
  const [activeModal, setActiveModal] = useState<ModalTab>(null)

  return (
    <footer className="footer" aria-label="Footer">
      {/* 1. Left Information Column */}
      <div className="jobs">
        <span className="tag">is your plant okay?</span>
        <span className="headline job-title">
          know your plant
          <br />
          before it wilts
        </span>

        <nav className="footer-nav" aria-label="Footer Navigation">
          <button type="button" className="nav-btn" onClick={onStartScan}>
            Scan
          </button>
          <button type="button" className="nav-btn" onClick={() => setActiveModal('plants')}>
            Plants
          </button>
          <button type="button" className="nav-btn" onClick={() => setActiveModal('how-it-works')}>
            How it works
          </button>
          <button type="button" className="nav-btn" onClick={() => setActiveModal('about')}>
            About
          </button>
        </nav>
      </div>

      {/* 2. Center Top Logo */}
      <div className="logo" role="img" aria-label="LeafLens logo">
        <svg viewBox="0 0 220 46" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          {/* Leaf sprout mark */}
          <path
            d="M16 34 C19 22 28 11 42 5 C39 19 30 29 20 34 C18.5 34.5 17 34.5 16 34 Z"
            fill="currentColor"
          />
          <path d="M16 34 C22 27 28 19 42 5" stroke="#b9d3b3" strokeWidth="2.2" strokeLinecap="round" />
          <text
            x="50"
            y="33"
            fill="currentColor"
            fontFamily="Epilogue, Arial, sans-serif"
            fontWeight="900"
            fontSize="32"
            letterSpacing="-0.5px"
          >
            LeafLens
          </text>
        </svg>
      </div>

      {/* 3. Right Information Column */}
      <div className="contact">
        <span className="tag">try it out</span>
        <div className="headline contact-links">
          <span>point. scan.</span>
          <span>know instantly*</span>
        </div>

        <div className="cta-row">
          <button type="button" className="cta-btn" onClick={onStartScan}>
            Start scanning
          </button>
        </div>

        <p className="note">*green means healthy, red means trouble, yellow means thinking.</p>
      </div>

      {/* 4. Center Pots Mascot Character in Background */}
      <div className="stage" aria-hidden="true">
        <div className="pots-container">
          <PotMascots />
        </div>
      </div>

      {/* In-page Modals for Navigation Items */}
      {activeModal && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            {activeModal === 'plants' && (
              <div>
                <h2>Supported Plants & Classes</h2>
                <p>LeafLens is trained exclusively on 18 classes across 4 plants:</p>
                <div style={{ marginTop: '16px' }}>
                  <h4 style={{ margin: '10px 0 4px 0', color: '#2f6b45' }}>🍅 Tomato (10 classes)</h4>
                  <ul style={{ paddingLeft: '20px', margin: '4px 0 14px 0', fontSize: '14px', lineHeight: '1.6' }}>
                    <li>Healthy</li>
                    <li>Bacterial spot</li>
                    <li>Early blight</li>
                    <li>Late blight</li>
                    <li>Leaf mold</li>
                    <li>Septoria leaf spot</li>
                    <li>Spider mites (two-spotted)</li>
                    <li>Target spot</li>
                    <li>Yellow leaf curl virus</li>
                    <li>Mosaic virus</li>
                  </ul>

                  <h4 style={{ margin: '10px 0 4px 0', color: '#2f6b45' }}>🥔 Potato (3 classes)</h4>
                  <ul style={{ paddingLeft: '20px', margin: '4px 0 14px 0', fontSize: '14px', lineHeight: '1.6' }}>
                    <li>Healthy</li>
                    <li>Early blight</li>
                    <li>Late blight</li>
                  </ul>

                  <h4 style={{ margin: '10px 0 4px 0', color: '#2f6b45' }}>🫑 Pepper (bell) (2 classes)</h4>
                  <ul style={{ paddingLeft: '20px', margin: '4px 0 14px 0', fontSize: '14px', lineHeight: '1.6' }}>
                    <li>Healthy</li>
                    <li>Bacterial spot</li>
                  </ul>

                  <h4 style={{ margin: '10px 0 4px 0', color: '#2f6b45' }}>🪴 Snake Plant (3 classes)</h4>
                  <ul style={{ paddingLeft: '20px', margin: '4px 0 14px 0', fontSize: '14px', lineHeight: '1.6' }}>
                    <li>Healthy</li>
                    <li>Anthracnose</li>
                    <li>Leaf withering</li>
                  </ul>
                </div>
                <p style={{ fontSize: '12px', opacity: 0.8, marginTop: '8px' }}>
                  <em>Note: Other plants or non-leaf objects trigger the yellow "Not sure" state.</em>
                </p>
              </div>
            )}

            {activeModal === 'how-it-works' && (
              <div>
                <h2>How It Works</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                  <div>
                    <strong style={{ color: '#2f6b45' }}>1. Hold a leaf in view</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', lineHeight: '1.5' }}>
                      Position the camera close to the leaf or upload a photo. The system captures multiple frames to average out lighting variations and blur.
                    </p>
                  </div>
                  <div>
                    <strong style={{ color: '#2f6b45' }}>2. Multi-crop leaf analysis</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', lineHeight: '1.5' }}>
                      Leaf regions are identified across an overlapping grid, preserving discoloration and lesion spots while ignoring irrelevant backgrounds.
                    </p>
                  </div>
                  <div>
                    <strong style={{ color: '#2f6b45' }}>3. Instant traffic-light health readout</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', lineHeight: '1.5' }}>
                      The neural model computes diagnostic confidence. 🟢 Green indicates a healthy leaf, 🔴 Red signals detected disease, and 🟡 Yellow indicates uncertainty.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeModal === 'about' && (
              <div>
                <h2>About LeafLens</h2>
                <p style={{ fontSize: '15px', lineHeight: '1.6', margin: '8px 0 16px 0' }}>
                  LeafLens is an <strong>ECS Mini Project (2026–27)</strong> software prototype.
                </p>
                <p style={{ fontSize: '14px', lineHeight: '1.5', margin: '8px 0' }}>
                  It simulates a future physical device consisting of a camera, LCD display, RGB LED indicator, and audio buzzer, running an efficient quantized MobileNetV2 model on a Raspberry Pi.
                </p>
                <p style={{ fontSize: '13px', background: 'rgba(47, 107, 69, 0.12)', padding: '12px', borderRadius: '8px', marginTop: '14px' }}>
                  🔒 <strong>Privacy Assurance:</strong> All scanning and inference are performed locally on your machine. No photos are transmitted to external servers or stored.
                </p>
              </div>
            )}

            <button type="button" className="modal-close-btn" onClick={() => setActiveModal(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </footer>
  )
}
