"use client";

import { useState } from "react";
import { Anchor, ExternalLink, Radio, Phone, BookOpen } from "lucide-react";
import { harbours } from "@/lib/harbours";
import "./harbours.css";

export default function HarbourGuide() {
  const [harbourId, setHarbourId] = useState("cowes");
  const harbour = harbours.find((item) => item.id === harbourId) || harbours[0];
  return (
    <section className="harbour-guide" aria-labelledby="harbour-guide-heading">
      <div className="harbour-heading">
        <div>
          <span className="eyebrow">KNOW YOUR NEXT PORT</span>
          <h2 id="harbour-guide-heading">Local knowledge & marinas</h2>
        </div>
        <label className="harbour-select">
          Harbour
          <select
            value={harbourId}
            onChange={(event) => setHarbourId(event.target.value)}
          >
            {harbours.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="harbour-summary">{harbour.introduction}</p>
      <div className="harbour-radio">
        <Radio size={17} />
        <span>{harbour.radio}</span>
      </div>
      <div className="harbour-columns">
        <div className="harbour-briefing">
          <h3>
            <BookOpen size={18} />
            Before you arrive
          </h3>
          <ul>
            {harbour.briefing.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="harbour-source-links">
            {harbour.sources.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.label}
                <ExternalLink size={12} />
              </a>
            ))}
          </div>
        </div>
        <div className="harbour-marinas">
          {harbour.marinas.map((marina) => (
            <article className="harbour-marina" key={marina.name}>
              <h3>
                <Anchor size={17} />
                {marina.name}
              </h3>
              <p>{marina.description}</p>
              <div className="harbour-tags">
                {marina.facilities.map((facility) => (
                  <span key={facility}>{facility}</span>
                ))}
              </div>
              <div className="harbour-contact">
                <span>
                  <Radio size={13} />
                  VHF {marina.vhf}
                </span>
                <a href={`tel:${marina.phone.replaceAll(" ", "")}`}>
                  <Phone size={13} />
                  {marina.phone}
                </a>
              </div>
              <a
                className="text-button"
                href={marina.website}
                target="_blank"
                rel="noreferrer"
              >
                Official marina information <ExternalLink size={13} />
              </a>
            </article>
          ))}
        </div>
      </div>
      <div className="harbour-directory">
        <div>
          <strong>Explore further with Marinas.com</strong>
          <p>
            Browse worldwide marina listings, photographs and reviews. Confirm
            operational details directly with the marina.
          </p>
        </div>
        <a
          className="button"
          href="https://marinas.com/browse/marina"
          target="_blank"
          rel="noreferrer"
        >
          Open marina directory <ExternalLink size={14} />
        </a>
      </div>
      <p className="harbour-provenance">
        Curated information checked {harbour.checkedAt} ·{" "}
        <a href={harbour.authority.url} target="_blank" rel="noreferrer">
          {harbour.authority.label}
        </a>{" "}
        and the linked marina operators. Availability, prices and live port
        notices are not monitored here. Use current official directions and
        charts for navigation.
      </p>
    </section>
  );
}
