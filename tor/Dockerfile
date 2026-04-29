FROM alpine:3.19
RUN apk add --no-cache tor && \
    mkdir -p /var/lib/tor && \
    chown -R tor:tor /var/lib/tor
COPY torrc /etc/tor/torrc
EXPOSE 9050 9051
USER tor
CMD ["tor", "-f", "/etc/tor/torrc"]
